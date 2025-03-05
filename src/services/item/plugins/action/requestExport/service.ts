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
import { Item } from '../../../../../drizzle/types';
import { TRANSLATIONS } from '../../../../../langs/constants';
import { MailBuilder } from '../../../../../plugins/mailer/builder';
import { MailerService } from '../../../../../plugins/mailer/mailer.service';
import { AuthenticatedUser, MinimalMember } from '../../../../../types';
import { EXPORT_FILE_EXPIRATION, ZIP_MIMETYPE } from '../../../../action/constants';
import {
  buildActionFilePath,
  buildItemTmpFolder,
  exportActionsInArchive,
} from '../../../../action/utils/export';
import { AuthorizationService } from '../../../../authorization';
import FileService from '../../../../file/service';
import { ItemService } from '../../../service';
import { ActionItemService } from '../action.service';
import { ActionRequestExportRepository } from './repository';

@singleton()
export class ActionRequestExportService {
  private readonly fileService: FileService;
  private readonly actionItemService: ActionItemService;
  private readonly itemService: ItemService;
  private readonly authorizationService: AuthorizationService;
  private readonly mailerService: MailerService;
  private readonly actionRequestExportRepository: ActionRequestExportRepository;

  constructor(
    actionItemService: ActionItemService,
    authorizationService: AuthorizationService,
    itemService: ItemService,
    fileService: FileService,
    mailerService: MailerService,
  ) {
    this.actionItemService = actionItemService;
    this.itemService = itemService;
    this.authorizationService = authorizationService;
    this.fileService = fileService;
    this.mailerService = mailerService;
  }

  async request(
    db: DBConnection,
    authenticatedUser: AuthenticatedUser,
    itemId: UUID,
    format: ExportActionsFormatting,
  ) {
    // check member has admin access to the item
    const item = await this.itemService.get(db, authenticatedUser, itemId);
    await this.authorizationService.validatePermission(
      db,
      PermissionLevel.Admin,
      authenticatedUser,
      item,
    );

    // get last export entry within interval
    const lastRequestExport = await this.actionRequestExportRepository.getLast(db, {
      memberId: authenticatedUser?.id,
      itemPath: item.path,
      format,
    });

    // check if a previous request already created the file and send it back
    if (lastRequestExport) {
      await this._sendExportLinkInMail(
        authenticatedUser,
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
      authenticatedUser,
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

    await this._sendExportLinkInMail(authenticatedUser, item, requestExport.createdAt, format);

    return item;
  }

  async _sendExportLinkInMail(
    actor: MinimalMember,
    item: Item,
    archiveDate: Date,
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
      lang: actor.lang,
    })
      .addText(TRANSLATIONS.EXPORT_ACTIONS_TEXT, {
        itemName: item.name,
        days: DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS.toString(),
        exportFormat: format,
      })
      .addButton(TRANSLATIONS.EXPORT_ACTIONS_BUTTON_TEXT, link)
      .build();

    this.mailerService.send(mail, actor.email).catch((err) => {
      console.debug(err, `mailer failed. export zip link: ${link}`);
    });
  }

  async _createAndUploadArchive(
    db,
    actor: Member,
    itemId: UUID,
    storageFolder: string,
    format: ExportActionsFormatting,
  ): Promise<ActionRequestExport> {
    // get actions and more data
    const baseAnalytics = await this.actionItemService.getBaseAnalyticsForItem(db, actor, {
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
      filepath: buildActionFilePath(itemId, archive.timestamp),
      mimetype: ZIP_MIMETYPE,
    });

    // create request row
    const requestExport = await this.actionRequestExportRepository.addOne(db, {
      item: baseAnalytics.item,
      member: actor,
      createdAt: new Date(archive.timestamp.getTime()),
      format,
    });

    return requestExport;
  }
}
