import archiver from 'archiver';
import fs, { mkdirSync } from 'fs';
import Papa from 'papaparse';
import path from 'path';

import { ExportActionsFormatting } from '@graasp/sdk';

import { TMP_FOLDER } from '../../../utils/config';
import { BaseAnalytics } from '../../item/plugins/action/base-analytics';
import { CannotWriteFileError } from './errors';

export const buildItemTmpFolder = (itemId: string): string =>
  path.join(TMP_FOLDER, 'export', itemId);
export const buildActionFileName = (name: string, datetime: string, format: string): string =>
  `${name}_${datetime}.${format}`;

export const buildActionFilePath = (itemId: string, datetime: Date): string =>
  // TODO: ISO??
  `actions/${itemId}/${datetime.toISOString()}`;

export const buildArchiveDateAsName = (timestamp: Date): string => timestamp.toISOString();

export interface ExportActionsInArchiveOutput {
  timestamp: Date;
  filepath: string;
}

// faltten object nested keys to have as item.id, member.id to be used for export csv header
const flattenObject = (obj: object, prefix: string = ''): object => {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
};

const writeFileForFormat = (
  path: string,
  format: ExportActionsFormatting,
  data: object[],
): void => {
  if (data.length) {
    switch (format) {
      case ExportActionsFormatting.CSV:
        const newData = data.map((obj) => flattenObject(obj));
        const csv = Papa.unparse(newData, {
          header: true,
          delimiter: ',',
        });

        fs.writeFileSync(path, csv);
        break;
      case ExportActionsFormatting.JSON:
      default:
        fs.writeFileSync(path, JSON.stringify(data));
    }
  }
};
export const exportActionsInArchive = async (args: {
  views: string[];
  storageFolder: string;
  baseAnalytics: BaseAnalytics;
  format: ExportActionsFormatting;
}): Promise<ExportActionsInArchiveOutput> => {
  const { baseAnalytics, storageFolder, views, format } = args;

  // timestamp and datetime are used to build folder name and human readable filename
  const timestamp = new Date();
  const archiveDate = buildArchiveDateAsName(timestamp);
  const fileName = `${baseAnalytics.item.name}_${archiveDate}`;

  // create tmp dir
  const outputPath = path.join(storageFolder, `${fileName}.zip`);
  const outputStream = fs.createWriteStream(outputPath);
  const archive = archiver('zip');
  archive.pipe(outputStream);

  archive.directory(fileName, false);

  try {
    const fileFolderPath = path.join(storageFolder, archiveDate);
    mkdirSync(fileFolderPath);

    // create file for each view
    views.forEach((viewName) => {
      const actionsPerView = baseAnalytics.actions.filter(({ view }) => view === viewName);
      const filename = buildActionFileName(`actions_${viewName}`, archiveDate, format);
      const viewFilepath = path.join(fileFolderPath, filename);

      writeFileForFormat(viewFilepath, format, actionsPerView);
    });

    // create file for item
    const itemFilepath = path.join(
      fileFolderPath,
      buildActionFileName('item', archiveDate, format),
    );
    writeFileForFormat(itemFilepath, format, [baseAnalytics.item]);

    // create file for descendants
    const descendantsFilepath = path.join(
      fileFolderPath,
      buildActionFileName('descendants', archiveDate, format),
    );
    writeFileForFormat(descendantsFilepath, format, baseAnalytics.descendants);

    // create file for the members
    const membersFilepath = path.join(
      fileFolderPath,
      buildActionFileName('members', archiveDate, format),
    );
    writeFileForFormat(membersFilepath, format, baseAnalytics.members);

    // create file for the memberships
    const iMembershipsPath = path.join(
      fileFolderPath,
      buildActionFileName('memberships', archiveDate, format),
    );
    writeFileForFormat(iMembershipsPath, format, baseAnalytics.itemMemberships);

    // create file for the chat messages
    const chatPath = path.join(fileFolderPath, buildActionFileName('chat', archiveDate, format));
    writeFileForFormat(chatPath, format, baseAnalytics.chatMessages);

    // create files for the apps
    const appsPath = path.join(fileFolderPath, buildActionFileName('apps', archiveDate, format));
    writeFileForFormat(appsPath, format, [baseAnalytics.apps]);

    // add directory in archive
    archive.directory(fileFolderPath, fileName);
  } catch (e) {
    throw new CannotWriteFileError(e);
  }

  // good practice to catch this error explicitly
  archive.on('error', function (err) {
    throw err;
  });

  // the archive is ready
  const promise = new Promise<ExportActionsInArchiveOutput>((resolve, reject) => {
    outputStream.on('error', (err) => {
      reject(err);
    });

    outputStream.on('close', async () => {
      resolve({
        timestamp,
        filepath: outputPath,
      });
    });
  });

  archive.finalize();

  return promise;
};
