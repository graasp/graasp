import { format as formatDate } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { singleton } from 'tsyringe';
import { ZipFile } from 'yazl';

import { Context, DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS, type UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../../drizzle/db';
import type {
  ActionRequestExportFormat,
  ActionRequestExportRaw,
} from '../../../../../drizzle/types';
import { TRANSLATIONS } from '../../../../../langs/constants';
import { BaseLogger } from '../../../../../logger';
import { MailBuilder } from '../../../../../plugins/mailer/builder';
import { MailerService } from '../../../../../plugins/mailer/mailer.service';
import type { MemberInfo, MinimalMember } from '../../../../../types';
import { TMP_FOLDER } from '../../../../../utils/config';
import { ActionRepository } from '../../../../action/action.repository';
import { EXPORT_FILE_EXPIRATION, ZIP_MIMETYPE } from '../../../../action/constants';
import { CannotWriteFileError } from '../../../../action/utils/errors';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import FileService from '../../../../file/file.service';
import { S3FileNotFound } from '../../../../file/utils/errors';
import { MemberService } from '../../../../member/member.service';
import { convertToValidFilename } from '../../../../utils';
import type { ItemRaw } from '../../../item';
import { ActionRequestExportRepository } from './itemAction.requestExport.repository';
import { formatData } from './utils';

@singleton()
export class ActionRequestExportService {
  private readonly fileService: FileService;
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly mailerService: MailerService;
  private readonly memberService: MemberService;
  private readonly actionRequestExportRepository: ActionRequestExportRepository;
  private readonly actionRepository: ActionRepository;
  private readonly logger: BaseLogger;

  constructor(
    authorizedItemService: AuthorizedItemService,
    fileService: FileService,
    mailerService: MailerService,
    memberService: MemberService,
    actionRequestExportRepository: ActionRequestExportRepository,
    logger: BaseLogger,
    actionRepository: ActionRepository,
  ) {
    this.authorizedItemService = authorizedItemService;
    this.fileService = fileService;
    this.mailerService = mailerService;
    this.memberService = memberService;
    this.actionRequestExportRepository = actionRequestExportRepository;
    this.logger = logger;
    this.actionRepository = actionRepository;
    this.authorizedItemService = authorizedItemService;
  }

  public async request(
    dbConnection: DBConnection,
    minimalMember: MinimalMember,
    itemId: UUID,
    format: ActionRequestExportFormat,
  ) {
    // check member has admin access to the item
    const member = await this.memberService.get(dbConnection, minimalMember.id);
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: minimalMember.id,
      itemId,
      permission: 'admin',
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

    // create request row
    const requestExport = await this.actionRequestExportRepository.addOne(dbConnection, {
      itemPath: item.path,
      memberId: minimalMember.id,
      createdAt: new Date().toISOString(),
      format,
    });

    // create archive and upload on server
    await this.createAndUploadArchive(dbConnection, minimalMember, item, requestExport);

    // send email
    await this.sendExportLinkInMail(member.toMemberInfo(), item, requestExport.createdAt, format);

    return item;
  }

  /**
   * Build file path where the archive should be saved on the server
   */
  private buildActionFilePath({
    itemId,
    format,
    itemName,
    datetime,
  }: {
    itemId: string;
    itemName: string;
    datetime: string;
    format: ActionRequestExportFormat;
  }): string {
    const name = convertToValidFilename(itemName);
    const filename = `${name}_${format}_actions_${formatDate(datetime, 't')}.zip`;
    return `actions/${itemId}/${filename}`;
  }

  /**
   * Build name for file within the archive
   * @param name
   * @param datetime
   * @param format
   * @returns
   */
  private buildActionFileName(name: string, datetime: string, format: string): string {
    return `${name}_${formatDate(datetime, 't')}.${format}`;
  }

  private async sendExportLinkInMail(
    member: MemberInfo,
    item: ItemRaw,
    archiveDate: string,
    format: ActionRequestExportFormat,
  ) {
    const filepath = this.buildActionFilePath({
      itemId: item.id,
      datetime: archiveDate,
      format,
      itemName: item.name,
    });
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

  /**
   * Gather data to make an archive, which is uploaded on the server
   * @param dbConnection
   * @param actor
   * @param item
   * @param format
   * @returns
   */
  private async createAndUploadArchive(
    dbConnection,
    actor: MinimalMember,
    item: ItemRaw,
    requestExport: ActionRequestExportRaw,
  ): Promise<void> {
    this.logger.debug('Create item action archive');

    const archive = await this.exportActionsInArchive(
      dbConnection,
      item,
      requestExport.format,
      requestExport.createdAt,
    );

    // upload zip
    const tmpFolder = path.join(TMP_FOLDER, 'export', item.id);
    fs.mkdirSync(tmpFolder, { recursive: true });
    const tmpFilePath = path.join(tmpFolder, requestExport.id);
    await pipeline(archive.outputStream, fs.createWriteStream(tmpFilePath));
    await this.fileService.upload(actor, {
      file: fs.createReadStream(tmpFilePath),
      filepath: this.buildActionFilePath({
        itemId: item.id,
        datetime: requestExport.createdAt,
        format: requestExport.format,
        itemName: item.name,
      }),
      mimetype: ZIP_MIMETYPE,
    });

    // delete tmp file
    if (fs.existsSync(tmpFilePath)) {
      try {
        fs.rmSync(tmpFilePath, { recursive: true });
      } catch (e) {
        this.logger.error(e);
      }
    } else {
      this.logger.error(`${tmpFilePath} was not found, and was not deleted`);
    }
  }

  /**
   * Create archive with gathered data for parent item
   * @param dbConnection
   * @param item
   * @param format
   * @param timestamp
   * @returns archive
   */
  private async exportActionsInArchive(
    dbConnection: DBConnection,
    item: ItemRaw,
    format: ActionRequestExportFormat,
    timestamp: string,
  ) {
    const rootName = `${convertToValidFilename(item.name)}_actions_${item.id}_${timestamp}`;

    const archive = new ZipFile();

    try {
      // create file for each view
      const actions = await this.actionRepository.getForItem(dbConnection, item.path);

      const views = [Context.Builder, Context.Player, Context.Library, Context.Unknown];
      views.forEach((viewName) => {
        const actionsPerView = actions.filter(({ view }) => view === viewName);
        const filename = this.buildActionFileName(`actions_${viewName}`, timestamp, format);

        const actionData = formatData(format, actionsPerView);
        archive.addBuffer(Buffer.from(actionData), path.join(rootName, filename));
      });

      // create file for items
      const items = await this.actionRequestExportRepository.getItemTree(dbConnection, item.path);
      const itemFilename = this.buildActionFileName('items', timestamp, format);
      const itemData = formatData(format, items);
      archive.addBuffer(Buffer.from(itemData), path.join(rootName, itemFilename));

      // create file for the members
      const accounts = await this.actionRequestExportRepository.getAccountsForTree(
        dbConnection,
        item.path,
      );
      const membersFilename = this.buildActionFileName('accounts', timestamp, format);
      const membersData = formatData(format, accounts);
      archive.addBuffer(Buffer.from(membersData), path.join(rootName, membersFilename));

      // create file for the memberships
      const itemMemberships = await this.actionRequestExportRepository.getItemMembershipsForTree(
        dbConnection,
        item.path,
      );
      const iMembershipsFilename = this.buildActionFileName('memberships', timestamp, format);
      const iMData = formatData(format, itemMemberships);
      archive.addBuffer(Buffer.from(iMData), path.join(rootName, iMembershipsFilename));

      // create file for the chat messages
      const chatMessages = await this.actionRequestExportRepository.getChatMessagesForTree(
        dbConnection,
        item.path,
      );
      const chatFilename = this.buildActionFileName('chat', timestamp, format);
      const chatData = formatData(format, chatMessages);
      archive.addBuffer(Buffer.from(chatData), path.join(rootName, chatFilename));

      // create files for the apps
      await this.exportAppsData(dbConnection, item, archive, format, timestamp, rootName);
    } catch (e) {
      console.error(e);
      throw new CannotWriteFileError(e);
    }

    archive.end();

    return archive;
  }

  /**
   * Put app related data in given archive, depending on format
   * @param dbConnection
   * @param item
   * @param archive
   * @param format
   * @param archiveDate
   * @param rootName
   */
  private async exportAppsData(
    dbConnection: DBConnection,
    item: ItemRaw,
    archive: ZipFile,
    format: ActionRequestExportFormat,
    archiveDate: string,
    rootName: string,
  ) {
    const appActions = await this.actionRequestExportRepository.getAppActionsForTree(
      dbConnection,
      item.path,
    );
    const appData = await this.actionRequestExportRepository.getAppDataForTree(
      dbConnection,
      item.path,
    );
    const appSettings = await this.actionRequestExportRepository.getAppSettingsForTree(
      dbConnection,
      item.path,
    );

    switch (format) {
      // For JSON format only output a single file
      case 'json': {
        // create files for the apps
        const appsFilename = this.buildActionFileName('apps', archiveDate, format);
        const appsData = formatData(format, {
          appActions,
          appData,
          appSettings,
        });
        archive.addBuffer(Buffer.from(appsData), path.join(rootName, appsFilename));
        break;
      }
      // For CSV format there will be one file for actions, one for data and one for settings
      // with all the apps together.
      case 'csv': {
        // create files for the apps
        const appActionsFilename = this.buildActionFileName('app_actions', archiveDate, format);
        const aaData = formatData(format, appActions);
        archive.addBuffer(Buffer.from(aaData), path.join(rootName, appActionsFilename));

        const appDataFilename = this.buildActionFileName('app_data', archiveDate, format);
        const adData = formatData(format, appData);
        archive.addBuffer(Buffer.from(adData), path.join(rootName, appDataFilename));

        const appSettingsFilename = this.buildActionFileName('app_settings', archiveDate, format);
        const asData = formatData(format, appSettings);
        archive.addBuffer(Buffer.from(asData), path.join(rootName, appSettingsFilename));

        break;
      }
    }
  }
}
