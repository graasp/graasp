import { format } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { singleton } from 'tsyringe';
import { ZipFile } from 'yazl';

import { DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { TRANSLATIONS } from '../../../../langs/constants';
import { MailBuilder } from '../../../../plugins/mailer/builder';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import type { MemberInfo, MinimalMember } from '../../../../types';
import { TMP_FOLDER } from '../../../../utils/config';
import { EXPORT_FILE_EXPIRATION, ZIP_MIMETYPE } from '../../../action/constants';
import FileService from '../../../file/file.service';
import { UnexpectedExportError } from '../../../item/plugins/importExport/errors';
import { ExportDataRepository } from './memberExportData.repository';
import { anonymizeMentionsMessage, anonymizeMessages } from './utils/anonymize.utils';

/**
 * DataToExport will be used to store each values in its own file with the name of the key.
 *
 * For instance, if you have { member: [Member, Member, ...], items: [Item, ...], ... },
 * it will be possible to save all members in a member.json file and another one for the items.
 */
export type DataToExport = { [dataName: string]: object[] };

@singleton()
export class ExportMemberDataService {
  private readonly exportDataRepository: ExportDataRepository;
  private readonly mailerService: MailerService;

  private readonly fileService: FileService;

  private readonly ROOT_EXPORT_FOLDER = 'export';

  constructor(
    exportDataRepository: ExportDataRepository,
    mailerService: MailerService,
    fileService: FileService,
  ) {
    this.exportDataRepository = exportDataRepository;
    this.mailerService = mailerService;
    this.fileService = fileService;
  }

  private buildUploadedExportFilePath(
    uploadedRootFolder: string,
    exportId: string,
    datetime: Date,
  ) {
    return `${uploadedRootFolder}/${exportId}/${datetime.toISOString()}`;
  }

  private addDataToArchive(
    archive: ZipFile,
    filename: string,
    values: object[],
    datetime: string,
  ): void {
    archive.addBuffer(Buffer.from(JSON.stringify(values)), `${filename}_${datetime}.json`);
  }

  /**
   * Create archive containing all member info, save the archive and send the download link by email
   * @param dbConnection db connection
   * @param memberInfo member whose data are exported
   */
  public async createArchiveAndSendByEmail(dbConnection: DBConnection, memberInfo: MemberInfo) {
    const exportId = memberInfo.id;
    const archiveCreationTime = new Date();
    const datetime = format(archiveCreationTime, 'yyyy-MM-dd HH-mm-ss');

    const archive = await this.createExportArchive(dbConnection, memberInfo, datetime);

    // save temporary zip because archive.outputStream is NodeJS.ReadableStream
    const tmpFolder = path.join(TMP_FOLDER, this.ROOT_EXPORT_FOLDER, exportId);
    fs.mkdirSync(tmpFolder, { recursive: true });
    const tmpFilepath = path.join(tmpFolder, memberInfo.id);
    await pipeline(archive.outputStream, fs.createWriteStream(tmpFilepath));
    const readFile = fs.createReadStream(tmpFilepath);

    // upload file
    const filepath = this.buildUploadedExportFilePath(
      this.ROOT_EXPORT_FOLDER,
      exportId,
      archiveCreationTime,
    );
    await this.fileService.upload(memberInfo, {
      file: readFile,
      filepath,
      mimetype: ZIP_MIMETYPE,
    });

    const link = await this.fileService.getUrl({
      path: filepath,
      expiration: EXPORT_FILE_EXPIRATION,
    });

    // send link
    this.sendExportLinkInMail(memberInfo, link);
  }

  /**
   * Utility function that creates an archive stream containing all data to export
   * @param dbConnection db connection
   * @param member member whose data are exported
   * @param datetime time of request
   * @returns complete archive with data to export
   */
  private async createExportArchive(
    dbConnection: DBConnection,
    member: MinimalMember,
    datetime: string,
  ): Promise<ZipFile> {
    // init archive
    const archive = new ZipFile();
    archive.outputStream.on('error', function (err) {
      throw new UnexpectedExportError(err);
    });
    this.addDataToArchive(
      archive,
      'actions',
      await this.getActions(dbConnection, member),
      datetime,
    );
    this.addDataToArchive(
      archive,
      'appActions',
      await this.getAppActions(dbConnection, member),
      datetime,
    );
    this.addDataToArchive(
      archive,
      'appData',
      await this.getAppData(dbConnection, member),
      datetime,
    );
    this.addDataToArchive(
      archive,
      'appSetting',
      await this.getAppSettings(dbConnection, member),
      datetime,
    );
    this.addDataToArchive(
      archive,
      'bookmarks',
      await this.getItemBookmarks(dbConnection, member),
      datetime,
    );
    this.addDataToArchive(
      archive,
      'chatMentions',
      await this.getChatMentions(dbConnection, member),
      datetime,
    );
    this.addDataToArchive(
      archive,
      'chatMessages',
      await this.getChatMessages(dbConnection, member),
      datetime,
    );
    this.addDataToArchive(archive, 'items', await this.getItems(dbConnection, member), datetime);
    this.addDataToArchive(
      archive,
      'likes',
      await this.getItemLikes(dbConnection, member),
      datetime,
    );
    this.addDataToArchive(
      archive,
      'memberships',
      await this.getItemsMemberShips(dbConnection, member),
      datetime,
    );

    archive.end();

    return archive;
  }

  private async getActions(dbConnection: DBConnection, actor: MinimalMember) {
    return await this.exportDataRepository.getActions(dbConnection, actor.id);
  }

  private async getAppActions(dbConnection: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getAppActions(dbConnection, actor.id);
    return results;
  }

  private async getAppData(dbConnection: DBConnection, actor: MinimalMember) {
    const appData = await this.exportDataRepository.getAppData(dbConnection, actor.id);
    return appData;
  }

  private async getAppSettings(dbConnection: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getAppSettings(dbConnection, actor.id);
    return results;
  }

  private async getChatMentions(dbConnection: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getChatMentions(dbConnection, actor.id);
    const anonymized = anonymizeMentionsMessage({
      results,
      exportingActorId: actor.id,
    });
    return anonymized;
  }

  private async getChatMessages(dbConnection: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getChatMessages(dbConnection, actor.id);
    const anonymized = anonymizeMessages({
      results,
      exportingActorId: actor.id,
    });
    return anonymized;
  }

  private async getItemsMemberShips(dbConnection: DBConnection, actor: MinimalMember) {
    const itemMemberShips = await this.exportDataRepository.getItemMemberships(
      dbConnection,
      actor.id,
    );
    return itemMemberShips;
  }

  private async getItems(dbConnection: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getItems(dbConnection, actor.id);
    return results;
  }

  private async getItemBookmarks(dbConnection: DBConnection, actor: MinimalMember) {
    const results = await this.exportDataRepository.getItemBookmarks(dbConnection, actor.id);
    return results;
  }

  private async getItemLikes(dbConnection: DBConnection, actor: MinimalMember) {
    // TODO: check if we should also export the likes created by another actor on its items
    // In this case, don't forget to anonymize the id of the other actor ?
    // Or should we put the username of the other actor who liked the item ?
    const results = await this.exportDataRepository.getByCreatorToExport(dbConnection, actor.id);
    return results;
  }

  private async sendExportLinkInMail(actor: MemberInfo, link: string) {
    const mail = new MailBuilder({
      subject: { text: TRANSLATIONS.EXPORT_MEMBER_DATA_TITLE },
      lang: actor.lang,
    })
      .addText(TRANSLATIONS.EXPORT_MEMBER_DATA_TEXT, {
        days: DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS.toString(),
      })
      .addButton(TRANSLATIONS.EXPORT_MEMBER_DATA_BUTTON_TEXT, link)
      .build();

    this.mailerService.send(mail, actor.email).catch((err) => {
      console.debug(err, `mailerService failed. export zip link: ${link}`);
    });
  }
}
