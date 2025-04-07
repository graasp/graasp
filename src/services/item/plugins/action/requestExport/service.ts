import fs from 'fs';
import { singleton } from 'tsyringe';

import {
  Context,
  DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS,
  ExportActionsFormatting,
  PermissionLevel,
  UUID,
} from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { ActionRequestExportRaw, Item } from '../../../../../drizzle/types';
import { TRANSLATIONS } from '../../../../../langs/constants';
import { MailBuilder } from '../../../../../plugins/mailer/builder';
import { MailerService } from '../../../../../plugins/mailer/mailer.service';
import { MemberInfo, MinimalMember } from '../../../../../types';
import { EXPORT_FILE_EXPIRATION, ZIP_MIMETYPE } from '../../../../action/constants';
import {
  buildActionFilePath,
  buildItemTmpFolder,
  exportActionsInArchive,
} from '../../../../action/utils/export';
import { AuthorizationService } from '../../../../authorization';
import FileService from '../../../../file/file.service';
import { MemberService } from '../../../../member/member.service';
import { BasicItemService } from '../../../basic.service';
import { ItemActionService } from '../itemAction.service';
import { ActionRequestExportRepository } from './repository';

@singleton()
export class ActionRequestExportService {
  private readonly fileService: FileService;
  private readonly itemActionService: ItemActionService;
  private readonly basicItemService: BasicItemService;
  private readonly authorizationService: AuthorizationService;
  private readonly mailerService: MailerService;
  private readonly memberService: MemberService;
  private readonly actionRequestExportRepository: ActionRequestExportRepository;

  constructor(
    itemActionService: ItemActionService,
    authorizationService: AuthorizationService,
    basicItemService: BasicItemService,
    fileService: FileService,
    mailerService: MailerService,
    memberService: MemberService,
    actionRequestExportRepository: ActionRequestExportRepository,
  ) {
    this.itemActionService = itemActionService;
    this.basicItemService = basicItemService;
    this.authorizationService = authorizationService;
    this.fileService = fileService;
    this.mailerService = mailerService;
    this.memberService = memberService;
    this.actionRequestExportRepository = actionRequestExportRepository;
  }

  async request(
    db: DBConnection,
    minimalMember: MinimalMember,
    itemId: UUID,
    format: ExportActionsFormatting,
  ) {
    // check member has admin access to the item
    const member = await this.memberService.get(db, minimalMember.id);
    const item = await this.basicItemService.get(db, minimalMember, itemId);
    await this.authorizationService.validatePermission(
      db,
      PermissionLevel.Admin,
      minimalMember,
      item,
    );

    // get last export entry within interval
    const lastRequestExport = await this.actionRequestExportRepository.getLast(db, {
      memberId: member?.id,
      itemPath: item.path,
      format,
    });

    // check if a previous request already created the file and send it back
    if (lastRequestExport) {
      await this._sendExportLinkInMail(
        member.toMemberInfo(),
        item,
        lastRequestExport.createdAt,
        format,
      );
      return;
      // the previous exported data does not exist or
      // is outdated and a new version should be uploaded
    }

    // get actions data and create archive in background
    // create tmp folder to temporaly save files
    const tmpFolder = buildItemTmpFolder(itemId);
    fs.mkdirSync(tmpFolder, { recursive: true });

    const requestExport = await this._createAndUploadArchive(
      db,
      minimalMember,
      itemId,
      tmpFolder,
      format,
    );

    // delete tmp folder
    if (fs.existsSync(tmpFolder)) {
      try {
        fs.rmSync(tmpFolder, { recursive: true });
      } catch (e) {
        console.error(e);
      }
    } else {
      console.error(`${tmpFolder} was not found, and was not deleted`);
    }

    await this._sendExportLinkInMail(member.toMemberInfo(), item, requestExport.createdAt, format);

    return item;
  }

  async _sendExportLinkInMail(
    member: MemberInfo,
    item: Item,
    archiveDate: string,
    format: ExportActionsFormatting,
  ) {
    const filepath = buildActionFilePath(item.id, archiveDate);
    const link = await this.fileService.getUrl({
      path: filepath,
      expiration: EXPORT_FILE_EXPIRATION,
    });

    const mail = new MailBuilder({
      subject: {
        text: TRANSLATIONS.EXPORT_ACTIONS_TITLE,
        translationVariables: {
          itemName: item.name,
        },
      },
      lang: member.lang,
    })
      .addText(TRANSLATIONS.EXPORT_ACTIONS_TEXT, {
        itemName: item.name,
        days: DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS.toString(),
        exportFormat: format,
      })
      .addButton(TRANSLATIONS.EXPORT_ACTIONS_BUTTON_TEXT, link)
      .build();

    this.mailerService.send(mail, member.email).catch((err) => {
      console.debug(err, `mailer failed. export zip link: ${link}`);
    });
  }

  async _createAndUploadArchive(
    db,
    actor: MinimalMember,
    itemId: UUID,
    storageFolder: string,
    format: ExportActionsFormatting,
  ): Promise<ActionRequestExportRaw> {
    // get actions and more data
    const baseAnalytics = await this.itemActionService.getBaseAnalyticsForItem(db, actor, {
      itemId,
    });

    // create archive given base analytics
    const archive = await exportActionsInArchive({
      storageFolder,
      baseAnalytics,
      // include all actions from any view
      views: Object.values(Context),
      format,
    });

    // upload file
    await this.fileService.upload(actor, {
      file: fs.createReadStream(archive.filepath),
      filepath: buildActionFilePath(itemId, archive.timestamp.toISOString()),
      mimetype: ZIP_MIMETYPE,
    });

    // create request row
    const requestExport = await this.actionRequestExportRepository.addOne(db, {
      itemPath: baseAnalytics.item.path,
      memberId: actor.id,
      createdAt: archive.timestamp.toISOString(),
      format,
    });

    return requestExport;
  }
}
