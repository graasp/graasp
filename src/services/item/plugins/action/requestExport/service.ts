import fs from 'fs';
import path from 'path';

import {
  Context,
  DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS,
  Hostname,
  PermissionLevel,
  UUID,
} from '@graasp/sdk';
import { MAIL } from '@graasp/translations';

import { TMP_FOLDER } from '../../../../../utils/config';
import { UnauthorizedMember } from '../../../../../utils/errors';
import { Repositories } from '../../../../../utils/repositories';
import { EXPORT_FILE_EXPIRATION, ZIP_MIMETYPE } from '../../../../action/constants/constants';
import { ActionService } from '../../../../action/services/action';
import {
  buildActionFilePath,
  buildItemTmpFolder,
  exportActionsInArchive,
} from '../../../../action/utils/export';
import { validatePermission } from '../../../../authorization';
import FileService from '../../../../file/service';
import { Actor, Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import ItemService from '../../../service';
import { ActionItemService } from '../service';
import { ActionRequestExport } from './requestExport';

export class ActionRequestExportService {
  fileService: FileService;
  actionItemService: ActionItemService;
  itemService: ItemService;
  actionService: ActionService;
  hosts: Hostname[];
  // TODO
  mailer: any;

  constructor(
    actionService: ActionService,
    actionItemService: ActionItemService,
    itemService: ItemService,
    fileService: FileService,
    mailer,
    hosts: Hostname[],
  ) {
    this.actionService = actionService;
    this.actionItemService = actionItemService;
    this.itemService = itemService;
    this.fileService = fileService;
    this.hosts = hosts;
    this.mailer = mailer;
  }

  async request(member: Actor, repositories: Repositories, itemId: UUID) {
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
    });

    // check if a previous request already created the file and send it back
    if (lastRequestExport) {
      await this._sendExportLinkInMail(member, item, lastRequestExport.createdAt);
      return;
      // the previous exported data does not exist or
      // is outdated and a new version should be uploaded
    }

    // get actions data and create archive in background
    // create tmp folder to temporaly save files
    const tmpFolder = path.join(TMP_FOLDER, 'export', itemId);
    fs.mkdirSync(tmpFolder, { recursive: true });

    const requestExport = await this._createAndUploadArchive(
      member,
      repositories,
      itemId,
      tmpFolder,
    );

    // delete tmp folder
    const fileStorage = buildItemTmpFolder(itemId);
    if (fs.existsSync(fileStorage)) {
      fs.rmSync(fileStorage, { recursive: true });
    } else {
      console?.error(`${fileStorage} was not found, and was not deleted`);
    }

    await this._sendExportLinkInMail(member, item, requestExport.createdAt);
  }

  async _sendExportLinkInMail(actor: Member, item: Item, archiveDate: Date) {
    const filepath = buildActionFilePath(item.id, archiveDate);
    const link = await this.fileService.download(actor, {
      id: item.id,
      path: filepath,
      mimetype: ZIP_MIMETYPE,
      expiration: EXPORT_FILE_EXPIRATION,
      replyUrl: true,
    });

    // factor out
    const lang = actor.lang;
    const t = this.mailer.translate(lang);

    const text = t(MAIL.EXPORT_ACTIONS_TEXT, {
      itemName: item.name,
      days: DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS,
    });
    const html = `
      ${this.mailer.buildText(text)}
      ${this.mailer.buildButton(link, t(MAIL.EXPORT_ACTIONS_BUTTON_TEXT))}
    `;
    const title = t(MAIL.EXPORT_ACTIONS_TITLE, { itemName: item.name });
    this.mailer.sendEmail(title, actor.email, link, html).catch((err) => {
      console.debug(err, `mailer failed. export zip link: ${link}`);
    });
  }

  async _createAndUploadArchive(
    actor: Member,
    repositories: Repositories,
    itemId: UUID,
    storageFolder: string,
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
    });

    return requestExport;
  }
}
