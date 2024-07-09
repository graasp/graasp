import fs from 'fs';
import { singleton } from 'tsyringe';

import {
  Context,
  DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS,
  ExportActionsFormatting,
  PermissionLevel,
  UUID,
} from '@graasp/sdk';

import { MAIL } from '../../../../../plugins/mailer/langs/constants';
import { MailerService } from '../../../../../plugins/mailer/service';
import { UnauthorizedMember } from '../../../../../utils/errors';
import { Repositories } from '../../../../../utils/repositories';
import { EXPORT_FILE_EXPIRATION, ZIP_MIMETYPE } from '../../../../action/constants/constants';
import {
  buildActionFilePath,
  buildItemTmpFolder,
  exportActionsInArchive,
} from '../../../../action/utils/export';
import { validatePermission } from '../../../../authorization';
import FileService from '../../../../file/service';
import { Actor, Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemService } from '../../../service';
import { ActionItemService } from '../service';
import { ActionRequestExport } from './requestExport';

@singleton()
export class ActionRequestExportService {
  private readonly fileService: FileService;
  private readonly actionItemService: ActionItemService;
  private readonly itemService: ItemService;
  private readonly mailerService: MailerService;

  constructor(
    actionItemService: ActionItemService,
    itemService: ItemService,
    fileService: FileService,
    mailerService: MailerService,
  ) {
    this.actionItemService = actionItemService;
    this.itemService = itemService;
    this.fileService = fileService;
    this.mailerService = mailerService;
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
    const t = this.mailerService.translate(lang);

    const text = t(MAIL.EXPORT_ACTIONS_TEXT, {
      itemName: item.name,
      days: DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS,
      exportFormat: format,
    });
    const html = `
      ${this.mailerService.buildText(text)}
      ${this.mailerService.buildButton(link, t(MAIL.EXPORT_ACTIONS_BUTTON_TEXT))}
    `;
    const title = t(MAIL.EXPORT_ACTIONS_TITLE, { itemName: item.name });

    const footer = this.mailerService.buildFooter(lang);

    this.mailerService.sendEmail(title, actor.email, link, html, footer).catch((err) => {
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
