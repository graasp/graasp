import archiver from 'archiver';
import { createObjectCsvWriter } from 'csv-writer';
import fs, { mkdirSync } from 'fs';
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
const flattenObject = (obj, prefix = '') => {
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

const writeFileDifferentFormat = (path, format, data) => {
  if (format === ExportActionsFormatting.JSON) {
    fs.writeFileSync(path, JSON.stringify(data));
  } else if (format === ExportActionsFormatting.CSV) {
    const flattenedData = flattenObject(data[0] || {});
    const header = Object.keys(flattenedData).map((key: string) => ({
      id: key,
      title: key.replace(/\./g, ' '),
    }));
    const csvWriter = createObjectCsvWriter({
      path,
      header,
      headerIdDelimiter: '.',
    });
    csvWriter.writeRecords(data);
  }
};
export const exportActionsInArchive = async (args: {
  views: string[];
  storageFolder: string;
  baseAnalytics: BaseAnalytics;
  format: string;
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

      writeFileDifferentFormat(viewFilepath, format, actionsPerView);
    });

    // create file for item
    const itemFilepath = path.join(
      fileFolderPath,
      buildActionFileName('item', archiveDate, format),
    );
    writeFileDifferentFormat(itemFilepath, format, [baseAnalytics.item]);

    // create file for descendants
    const descendantsFilepath = path.join(
      fileFolderPath,
      buildActionFileName('descendants', archiveDate, format),
    );
    writeFileDifferentFormat(descendantsFilepath, format, baseAnalytics.descendants);

    // create file for the members
    const membersFilepath = path.join(
      fileFolderPath,
      buildActionFileName('members', archiveDate, format),
    );
    writeFileDifferentFormat(membersFilepath, format, baseAnalytics.members);

    // create file for the memberships
    const iMembershipsPath = path.join(
      fileFolderPath,
      buildActionFileName('memberships', archiveDate, format),
    );
    writeFileDifferentFormat(iMembershipsPath, format, baseAnalytics.itemMemberships);

    // create file for the chat messages
    const chatPath = path.join(fileFolderPath, buildActionFileName('chat', archiveDate, format));
    writeFileDifferentFormat(chatPath, format, baseAnalytics.chatMessages);

    // create files for the apps
    const appsPath = path.join(fileFolderPath, buildActionFileName('apps', archiveDate, format));
    writeFileDifferentFormat(appsPath, format, baseAnalytics.apps);

    archive.directory(fileFolderPath, fileName);

    // add directory in archive
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
