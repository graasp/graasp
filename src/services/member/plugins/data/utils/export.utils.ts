import archiver from 'archiver';
import fs, { mkdirSync } from 'fs';
import path from 'path';

import { DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS } from '@graasp/sdk';

import { MailerDecoration } from '../../../../../plugins/mailer';
import { MAIL } from '../../../../../plugins/mailer/langs/constants';
import { TMP_FOLDER } from '../../../../../utils/config';
import { EXPORT_FILE_EXPIRATION, ZIP_MIMETYPE } from '../../../../action/constants/constants';
import { CannotWriteFileError } from '../../../../action/utils/errors';
import FileService from '../../../../file/service';
import { Member } from '../../../entities/member';

/**
 * DataToExport will be used to store each values in its own file with the name of the key.
 *
 * For instance, if you have { member: [Member, Member, ...], items: [Item, ...], ... },
 * it will be possible to save all members in a member.json file and another one for the items.
 */
export type DataToExport = { [dataName: string]: object[] };
type ExportDataInArchiveOutput = {
  timestamp: Date;
  filepath: string;
};

export class DataArchiver {
  private readonly dataToExport: DataToExport;
  private readonly storageFolder: string;
  private readonly timestamp: Date;
  private readonly archiveDate: string;
  private readonly fileName: string;

  public constructor({
    dataToExport,
    archiveFileName,
    storageFolder,
  }: {
    dataToExport: DataToExport;
    archiveFileName: string;
    storageFolder: string;
  }) {
    this.dataToExport = dataToExport;
    this.storageFolder = storageFolder;

    this.timestamp = new Date();
    this.archiveDate = this.timestamp.toISOString();
    this.fileName = `${archiveFileName}_${this.archiveDate}`;
  }

  /**
   * Save each data in its own file JSON file.
   * @param folderPath The folder where to write the file.
   */
  private saveDataFiles(folderPath: string) {
    Object.entries(this.dataToExport).forEach(([name, data]) => {
      if (data.length) {
        const fileName = `${name}_${this.archiveDate}.json`;
        const filePath = path.join(folderPath, fileName);
        fs.writeFileSync(filePath, JSON.stringify(data));
      }
    });
  }

  private createFolder(storageFolder: string, folderName: string) {
    const folderPath = path.join(storageFolder, folderName);
    mkdirSync(folderPath);
    return folderPath;
  }

  private createArchive() {
    const outputPath = path.join(this.storageFolder, `${this.fileName}.zip`);
    const outputStream = fs.createWriteStream(outputPath);

    const archive = archiver('zip');
    archive.pipe(outputStream);
    archive.directory(this.fileName, false);
    // good practice to catch this error explicitly
    archive.on('error', function (err) {
      throw err;
    });

    const promise = new Promise<ExportDataInArchiveOutput>((resolve, reject) => {
      outputStream.on('error', (err) => {
        reject(err);
      });

      outputStream.on('close', async () => {
        resolve({
          timestamp: this.timestamp,
          filepath: outputPath,
        });
      });
    });

    return { archive, promise };
  }

  private addDataToArchive(archive: archiver.Archiver) {
    try {
      const folderPath = this.createFolder(this.storageFolder, this.fileName);
      this.saveDataFiles(folderPath);
      const rootFolderNameInArchive = this.fileName;
      archive.directory(folderPath, rootFolderNameInArchive);
    } catch (e) {
      throw new CannotWriteFileError(e);
    }
  }

  public async archiveData() {
    const { archive, promise } = this.createArchive();
    this.addDataToArchive(archive);
    archive.finalize();
    return promise;
  }
}

export function buildUploadedExportFilePath(
  uploadedRootFolder: string,
  exportId: string,
  datetime: Date,
) {
  return `${uploadedRootFolder}/${exportId}/${datetime.toISOString()}`;
}

export class ArchiveDataExporter {
  /**
   * Archives the data and upload with the FileService
   * @param uploadedRootFolder The root folder where the archive will be uploaded.
   * @param storageFolder The folder where the archive will be created.
   * @param exportId The ID who represent the export. It can be the member ID or item Id i.e.
   * @returns
   */
  async createAndUploadArchive({
    fileService,
    member,
    exportId,
    dataToExport,
    storageFolder,
    uploadedRootFolder,
  }: {
    fileService: FileService;
    member: Member;
    exportId: string;
    dataToExport: DataToExport;
    storageFolder: string;
    uploadedRootFolder: string;
  }) {
    const archive = await new DataArchiver({
      dataToExport,
      storageFolder,
      archiveFileName: exportId,
    }).archiveData();

    const archivedFile = fs.createReadStream(archive.filepath);

    // upload file
    await fileService.upload(member, {
      file: archivedFile,
      filepath: buildUploadedExportFilePath(uploadedRootFolder, exportId, archive.timestamp),
      mimetype: ZIP_MIMETYPE,
    });

    return { archiveCreationTime: new Date(archive.timestamp.getTime()) };
  }
}

export class RequestDataExportService {
  private fileService: FileService;
  private mailer: MailerDecoration;

  private readonly ROOT_EXPORT_FOLDER = 'export';

  constructor(fileService: FileService, mailer: MailerDecoration) {
    this.fileService = fileService;
    this.mailer = mailer;
  }

  private async _sendExportLinkInMail(actor: Member, exportId: string, archiveDate: Date) {
    const filepath = buildUploadedExportFilePath(this.ROOT_EXPORT_FOLDER, exportId, archiveDate);
    const link = await this.fileService.getUrl(actor, {
      id: exportId,
      path: filepath,
      expiration: EXPORT_FILE_EXPIRATION,
    });

    // factor out
    const lang = actor.lang;
    const t = this.mailer.translate(lang);

    const text = t(MAIL.EXPORT_DATA_TEXT, {
      days: DEFAULT_EXPORT_ACTIONS_VALIDITY_IN_DAYS,
    });
    const html = `
        ${this.mailer.buildText(text)}
        ${this.mailer.buildButton(link, t(MAIL.EXPORT_DATA_BUTTON_TEXT))}
      `;
    const title = t(MAIL.EXPORT_DATA_TITLE);

    const footer = this.mailer.buildFooter(lang);

    this.mailer.sendEmail(title, actor.email, link, html, footer).catch((err) => {
      console.debug(err, `mailer failed. export zip link: ${link}`);
    });
  }

  async requestExport(
    member: Member,
    exportId: string,
    dataRetriever: () => Promise<DataToExport>,
  ) {
    // For now, there is no check in the database for last export.

    const dataToExport = await dataRetriever();

    // create tmp folder to temporaly save files
    const tmpFolder = path.join(TMP_FOLDER, this.ROOT_EXPORT_FOLDER, exportId);
    fs.mkdirSync(tmpFolder, { recursive: true });

    // archives the data and upload it.
    const { archiveCreationTime } = await new ArchiveDataExporter().createAndUploadArchive({
      fileService: this.fileService,
      member,
      exportId,
      dataToExport,
      storageFolder: tmpFolder,
      uploadedRootFolder: this.ROOT_EXPORT_FOLDER,
    });

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

    this._sendExportLinkInMail(member, exportId, archiveCreationTime);
  }
}
