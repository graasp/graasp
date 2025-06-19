import { format as formatDate } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
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
import { BaseLogger } from '../../../../../logger';
import { MailBuilder } from '../../../../../plugins/mailer/builder';
import { MailerService } from '../../../../../plugins/mailer/mailer.service';
import type { MemberInfo, MinimalMember } from '../../../../../types';
import { TMP_FOLDER } from '../../../../../utils/config';
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

const EXPORT_TMP_FOLDER = path.join(TMP_FOLDER, 'item-export');
fs.mkdirSync(EXPORT_TMP_FOLDER, { recursive: true });

@singleton()
export class ActionRequestExportService {
  private readonly fileService: FileService;
  private readonly itemActionService: ItemActionService;
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly mailerService: MailerService;
  private readonly memberService: MemberService;
  private readonly actionRequestExportRepository: ActionRequestExportRepository;
  private readonly logger: BaseLogger;

  constructor(
    itemActionService: ItemActionService,
    authorizedItemService: AuthorizedItemService,
    fileService: FileService,
    mailerService: MailerService,
    memberService: MemberService,
    actionRequestExportRepository: ActionRequestExportRepository,
    logger: BaseLogger,
  ) {
    this.itemActionService = itemActionService;
    this.authorizedItemService = authorizedItemService;
    this.fileService = fileService;
    this.mailerService = mailerService;
    this.memberService = memberService;
    this.actionRequestExportRepository = actionRequestExportRepository;
    this.logger = logger;
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
        await this.sendExportLinkInMail(
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

    const requestExport = await this.createAndUploadArchive(
      dbConnection,
      minimalMember,
      itemId,
      format,
    );

    await this.sendExportLinkInMail(member.toMemberInfo(), item, requestExport.createdAt, format);

    return item;
  }

  private async sendExportLinkInMail(
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

  private async createAndUploadArchive(
    dbConnection,
    actor: MinimalMember,
    itemId: UUID,
    format: ExportActionsFormatting,
  ): Promise<ActionRequestExportRaw> {
    this.logger.debug('Create item action archive');

    // get actions and more data
    const baseAnalytics = await this.itemActionService.getBaseAnalyticsForItem(
      dbConnection,
      actor,
      {
        itemId,
      },
    );

    // create archive given base analytics
    const timestamp = new Date();
    const archive = await exportActionsInArchive({
      baseAnalytics,
      views: [Context.Builder, Context.Player, Context.Library, Context.Unknown],
      format,
      timestamp,
    });

    // create request row
    const requestExport = await this.actionRequestExportRepository.addOne(dbConnection, {
      itemPath: baseAnalytics.item.path,
      memberId: actor.id,
      createdAt: timestamp.toISOString(),
      format,
    });

    // upload zip
    // get actions data and create archive in background
    // create tmp folder to temporaly save files
    const tmpFolder = buildItemTmpFolder(itemId);
    fs.mkdirSync(tmpFolder, { recursive: true });
    const tmpFilePath = path.join(tmpFolder, requestExport.id);
    await pipeline(archive.outputStream, fs.createWriteStream(tmpFilePath));
    await this.fileService.upload(actor, {
      file: fs.createReadStream(tmpFilePath),
      filepath: buildActionFilePath({
        itemId,
        datetime: requestExport.createdAt,
        format,
      }),
      mimetype: ZIP_MIMETYPE,
    });

    // delete tmp file
    if (fs.existsSync(tmpFilePath)) {
      try {
        fs.rmSync(tmpFilePath, { recursive: true });
      } catch (e) {
        console.error(e);
      }
    } else {
      console.error(`${tmpFilePath} was not found, and was not deleted`);
    }

    return requestExport;
  }
}
