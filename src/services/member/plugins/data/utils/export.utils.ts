import archiver from 'archiver';
import fs, { mkdirSync } from 'fs';
import path from 'path';

import { ZIP_MIMETYPE } from '../../../../action/constants/constants';
import { CannotWriteFileError } from '../../../../action/utils/errors';
import FileService from '../../../../file/service';
import { Member } from '../../../entities/member';

/**
 * DataToExport will be used to store each values in its own file with the name of the key.
 *
 * For instance, if you have { member: [Member, Member, ...], items: [Item, ...], ... },
 * it will be possible to save all members in a member.json file and another one for the items.
 */
type DataToExport = { [dataName: string]: object[] };
type ExportDataInArchiveOutput = {
  timestamp: Date;
  filepath: string;
};

class DataArchiver {
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
      const folderPath = this.createFolder(this.storageFolder, this.archiveDate);
      this.saveDataFiles(folderPath);
      archive.directory(folderPath, this.fileName);
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

    const filePath = buildUploadedExportFilePath(uploadedRootFolder, exportId, archive.timestamp);

    // upload file
    await fileService.upload(member, {
      file: fs.createReadStream(archive.filepath),
      filepath: filePath,
      mimetype: ZIP_MIMETYPE,
    });

    return { archiveCreationTime: new Date(archive.timestamp.getTime()) };
  }
}
