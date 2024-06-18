import fs from 'fs';

import {
  Context,
  DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS,
  ExportActionsFormatting,
  PermissionLevel,
  UUID,
} from '@graasp/sdk';

import { MailerDecoration } from '../../../../../plugins/mailer/index.js';
import { MAIL } from '../../../../../plugins/mailer/langs/constants.js';
import { UnauthorizedMember } from '../../../../../utils/errors.js';
import { Repositories } from '../../../../../utils/repositories.js';
import { EXPORT_FILE_EXPIRATION, ZIP_MIMETYPE } from '../../../../action/constants/constants.js';
import { ActionService } from '../../../../action/services/action.js';
import {
  buildActionFilePath,
  buildItemTmpFolder,
  exportActionsInArchive,
} from '../../../../action/utils/export.js';
import { validatePermission } from '../../../../authorization.js';
import FileService from '../../../../file/service.js';
import { Actor, Member } from '../../../../member/entities/member.js';
import { Item } from '../../../entities/Item.js';
import { ItemService } from '../../../service.js';
import { ActionItemService } from '../service.js';
import { ActionRequestExport } from './requestExport.js';

export class ActionRequestExportService {
  fileService: FileService;
  actionItemService: ActionItemService;
  itemService: ItemService;
  actionService: ActionService;
  mailer: MailerDecoration;

  constructor(
    actionService: ActionService,
    actionItemService: ActionItemService,
    itemService: ItemService,
    fileService: FileService,
    mailer,
  ) {
    this.actionService = actionService;
    this.actionItemService = actionItemService;
    this.itemService = itemService;
    this.fileService = fileService;
    this.mailer = mailer;
  }

  async request(
    member: Actor,
    repositories: Repositories,
    itemId: UUID,
    format: ExportActionsFormatting,
  ) {
    if (!member) {
      throw new UnauthorizedMember(member);
    }

    // check member has admin access to the item
    const item = await this.itemService.get(member, repositories, itemId);
    await validatePermission(repositories, PermissionLevel.Admin, member, item);

    // get last export entry within interval
    const lastRequestExport = await repositories.actionRequestExportRepository.getLast({
      memberId: member?.id,
      itemPath: item.path,
      format,
    });

    // check if a previous request already created the file and send it back
    if (lastRequestExport) {
      await this._sendExportLinkInMail(member, item, lastRequestExport.createdAt, format);
      return;
      // the previous exported data does not exist or
      // is outdated and a new version should be uploaded
    }

    // get actions data and create archive in background
    // create tmp folder to temporaly save files
    const tmpFolder = buildItemTmpFolder(itemId);
    fs.mkdirSync(tmpFolder, { recursive: true });

    const requestExport = await this._createAndUploadArchive(
      member,
      repositories,
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

    await this._sendExportLinkInMail(member, item, requestExport.createdAt, format);

    return item;
  }

  async _sendExportLinkInMail(
    actor: Member,
    item: Item,
    archiveDate: Date,
    format: ExportActionsFormatting,
  ) {
    const filepath = buildActionFilePath(item.id, archiveDate);
    const link = await this.fileService.getUrl(actor, {
      id: item.id,
      path: filepath,
      expiration: EXPORT_FILE_EXPIRATION,
    });

    // factor out
    const lang = actor.lang;
    const t = this.mailer.translate(lang);

    const text = t(MAIL.EXPORT_ACTIONS_TEXT, {
      itemName: item.name,
      days: DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS,
      exportFormat: format,
    });
    const html = `
      ${this.mailer.buildText(text)}
      ${this.mailer.buildButton(link, t(MAIL.EXPORT_ACTIONS_BUTTON_TEXT))}
    `;
    const title = t(MAIL.EXPORT_ACTIONS_TITLE, { itemName: item.name });

    const footer = this.mailer.buildFooter(lang);

    this.mailer.sendEmail(title, actor.email, link, html, footer).catch((err) => {
      console.debug(err, `mailer failed. export zip link: ${link}`);
    });
  }

  async _createAndUploadArchive(
    actor: Member,
    repositories: Repositories,
    itemId: UUID,
    storageFolder: string,
    format: ExportActionsFormatting,
  ): Promise<ActionRequestExport> {
    // get actions and more data
    const baseAnalytics = await this.actionItemService.getBaseAnalyticsForItem(
      actor,
      repositories,
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

    // upload file
    await this.fileService.upload(actor, {
      file: fs.createReadStream(archive.filepath),
      filepath: buildActionFilePath(itemId, archive.timestamp),
      mimetype: ZIP_MIMETYPE,
    });

    // create request row
    const requestExport = await repositories.actionRequestExportRepository.post({
      item: baseAnalytics.item,
      member: actor,
      createdAt: new Date(archive.timestamp.getTime()),
      format,
    });

    return requestExport;
  }
}
