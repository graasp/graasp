import { format as formatDate } from 'date-fns';
import fs from 'fs';
import { singleton } from 'tsyringe';

import {
  Context,
  DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS,
  ExportActionsFormatting,
  PermissionLevel,
  type UUID,
} from '@graasp/sdk';

import { type DBConnection } from '../../../../../drizzle/db';
import type { ActionRequestExportRaw, ItemRaw } from '../../../../../drizzle/types';
import { TRANSLATIONS } from '../../../../../langs/constants';
import { MailBuilder } from '../../../../../plugins/mailer/builder';
import { MailerService } from '../../../../../plugins/mailer/mailer.service';
import type { MemberInfo, MinimalMember } from '../../../../../types';
import { EXPORT_FILE_EXPIRATION, ZIP_MIMETYPE } from '../../../../action/constants';
import {
  buildActionFilePath,
  buildItemTmpFolder,
  exportActionsInArchive,
} from '../../../../action/utils/export';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import FileService from '../../../../file/file.service';
import { S3FileNotFound } from '../../../../file/utils/errors';
import { MemberService } from '../../../../member/member.service';
import { ItemActionService } from '../itemAction.service';
import { ActionRequestExportRepository } from './repository';

@singleton()
export class ActionRequestExportService {
  private readonly fileService: FileService;
  private readonly itemActionService: ItemActionService;
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly mailerService: MailerService;
  private readonly memberService: MemberService;
  private readonly actionRequestExportRepository: ActionRequestExportRepository;

  constructor(
    itemActionService: ItemActionService,
    authorizedItemService: AuthorizedItemService,
    fileService: FileService,
    mailerService: MailerService,
    memberService: MemberService,
    actionRequestExportRepository: ActionRequestExportRepository,
  ) {
    this.itemActionService = itemActionService;
    this.authorizedItemService = authorizedItemService;
    this.fileService = fileService;
    this.mailerService = mailerService;
    this.memberService = memberService;
    this.actionRequestExportRepository = actionRequestExportRepository;
  }

  async request(
    dbConnection: DBConnection,
    minimalMember: MinimalMember,
    itemId: UUID,
    format: ExportActionsFormatting,
  ) {
    // check member has admin access to the item
    const member = await this.memberService.get(dbConnection, minimalMember.id);
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      actor: minimalMember,
      itemId,
      permission: PermissionLevel.Admin,
    });

    // get last export entry within interval
    const lastRequestExport = await this.actionRequestExportRepository.getLast(dbConnection, {
      memberId: member?.id,
      itemPath: item.path,
      format,
    });

    // check if a previous request already created the file and send it back
    try {
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
    } catch (e) {
      // previous request export exists but not the file
      // we should create a new export
      if (!(e instanceof S3FileNotFound)) {
        throw e;
      }
    }

    // get actions data and create archive in background
    // create tmp folder to temporaly save files
    const tmpFolder = buildItemTmpFolder(itemId);
    fs.mkdirSync(tmpFolder, { recursive: true });

    const requestExport = await this._createAndUploadArchive(
      dbConnection,
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
    item: ItemRaw,
    archiveDate: string,
    format: ExportActionsFormatting,
  ) {
    const filepath = buildActionFilePath({
      itemId: item.id,
      datetime: archiveDate,
      format,
    });
    const link = await this.fileService.getUrl({
      path: filepath,
      expiration: EXPORT_FILE_EXPIRATION,
      downloadName: `${item.name}_${format}_actions_${formatDate(archiveDate, 't')}.zip`,
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
    dbConnection,
    actor: MinimalMember,
    itemId: UUID,
    storageFolder: string,
    format: ExportActionsFormatting,
  ): Promise<ActionRequestExportRaw> {
    // get actions and more data
    const baseAnalytics = await this.itemActionService.getBaseAnalyticsForItem(
      dbConnection,
      actor,
      {
        itemId,
      },
    );

    // create archive given base analytics
    const archive = await exportActionsInArchive({
      storageFolder,
      baseAnalytics,
      // include all actions from any view
      views: Object.values(Context),
      format,
    });

    // create request row
    const requestExport = await this.actionRequestExportRepository.addOne(dbConnection, {
      itemPath: baseAnalytics.item.path,
      memberId: actor.id,
      createdAt: archive.timestamp.toISOString(),
      format,
    });

    // upload file
    await this.fileService.upload(actor, {
      file: fs.createReadStream(archive.filepath),
      filepath: buildActionFilePath({
        itemId,
        datetime: requestExport.createdAt,
        format,
      }),
      mimetype: ZIP_MIMETYPE,
    });

    return requestExport;
  }
}
