import { format as formatDate } from 'date-fns';
import { unparse } from 'papaparse';
import path from 'path';
import { ZipFile } from 'yazl';

import { ExportActionsFormatting } from '@graasp/sdk';

import { AppActionRaw, AppDataRaw, AppSettingRaw } from '../../../drizzle/types';
import { TMP_FOLDER } from '../../../utils/config';
import { CannotWriteFileError } from './errors';

export const buildItemTmpFolder = (itemId: string): string =>
  path.join(TMP_FOLDER, 'export', itemId);
export const buildActionFileName = (name: string, datetime: string, format: string): string =>
  `${name}_${formatDate(datetime, 't')}.${format}`;

export const buildActionFilePath = ({
  itemId,
  datetime,
  format,
}: {
  itemId: string;
  datetime: string;
  format: ExportActionsFormatting;
}): string => {
  return `actions/${itemId}/${format}/${formatDate(datetime, 't')}.zip`;
};

export const buildArchiveDateAsName = (timestamp: Date): string => timestamp.toISOString();

export interface ExportActionsInArchiveOutput {
  timestamp: Date;
  filepath: string;
}

type RecursiveObject = { [key: string]: string | number | RecursiveObject };
type ReturnObject = { [key: string]: string | number };
// flatten object nested keys to have as item.id, member.id to be used for export csv header
const flattenObject = (obj: RecursiveObject, prefix: string = ''): ReturnObject => {
  return Object.keys(obj).reduce((acc, k) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k] as RecursiveObject, pre + k));
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
};

export const formatData = <T extends object>(
  format: ExportActionsFormatting,
  data: T[] | T,
): string => {
  console.log(data);
  switch (format) {
    case ExportActionsFormatting.CSV: {
      if (Array.isArray(data)) {
        const newData = data.map((obj) => flattenObject(obj as RecursiveObject));
        const csv = unparse(newData, {
          header: true,
          delimiter: ',',
        });

        return csv;
      }
      /// !!!!
      throw new Error('TODO');
    }
    case ExportActionsFormatting.JSON:
    default: {
      // data can be an object or an array of objects
      if (
        (Array.isArray(data) && data.length) ||
        (!Array.isArray(data) && Object.keys(data).length)
      ) {
        return JSON.stringify(data);
      }
      return JSON.stringify({});
    }
  }
};

export const exportActionsInArchive = async (args: {
  views: string[];
  baseAnalytics: any;
  format: ExportActionsFormatting;
  timestamp: Date;
}) => {
  const { baseAnalytics, views, format, timestamp } = args;

  // timestamp and datetime are used to build folder name and human readable filename
  const archiveDate = buildArchiveDateAsName(timestamp);
  const rootName = `actions_${baseAnalytics.item.id}_${archiveDate}`;

  // create tmp dir
  // const outputPath = path.join(storageFolder, `${fileName}.zip`);
  // const outputStream = fs.createWriteStream(outputPath);
  const archive = new ZipFile();
  // archive.pipe(outputStream);
  console.log(baseAnalytics);
  // archive.directory(fileName, false);
  try {
    // create file for each view
    views.forEach((viewName) => {
      const actionsPerView = baseAnalytics.actions.filter(({ view }) => view === viewName);
      const filename = buildActionFileName(`actions_${viewName}`, archiveDate, format);

      const data = formatData(format, actionsPerView);
      archive.addBuffer(Buffer.from(data), path.join(rootName, filename));
    });

    // create file for item
    const itemFilename = buildActionFileName('item', archiveDate, format);
    const itemData = formatData(format, [baseAnalytics.item]);
    archive.addBuffer(Buffer.from(itemData), path.join(rootName, itemFilename));

    // create file for descendants
    const descendantsFilename = buildActionFileName('descendants', archiveDate, format);
    const descendantsData = formatData(format, baseAnalytics.descendants);
    archive.addBuffer(Buffer.from(descendantsData), path.join(rootName, descendantsFilename));

    // create file for the members
    const membersFilename = buildActionFileName('members', archiveDate, format);
    const membersData = formatData(format, baseAnalytics.members);
    archive.addBuffer(Buffer.from(membersData), path.join(rootName, membersFilename));

    // create file for the memberships
    const iMembershipsFilename = buildActionFileName('memberships', archiveDate, format);
    const iMData = formatData(format, baseAnalytics.itemMemberships);
    archive.addBuffer(Buffer.from(iMData), path.join(rootName, iMembershipsFilename));

    // create file for the chat messages
    const chatFilename = buildActionFileName('chat', archiveDate, format);
    const chatData = formatData(format, baseAnalytics.chatMessages);
    archive.addBuffer(Buffer.from(chatData), path.join(rootName, chatFilename));

    // merge together actions, data and settings from all app_items
    const { appActions, appData, appSettings } = Object.entries(baseAnalytics.apps).reduce<{
      appActions: AppActionRaw[];
      appData: AppDataRaw[];
      appSettings: AppSettingRaw[];
    }>(
      (
        acc,
        [_appID, { actions, data, settings }]: [
          string,
          {
            actions: AppActionRaw[];
            data: AppDataRaw[];
            settings: AppSettingRaw[];
          },
        ],
      ) => {
        acc.appActions.push(...actions);
        acc.appData.push(...data);
        acc.appSettings.push(...settings);
        return acc;
      },
      { appActions: [], appData: [], appSettings: [] },
    );

    switch (format) {
      // For JSON format only output a single file
      case ExportActionsFormatting.JSON: {
        // create files for the apps
        const appsFilename = buildActionFileName('apps', archiveDate, format);
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
      case ExportActionsFormatting.CSV: {
        // create files for the apps
        const appActionsFilename = buildActionFileName('app_actions', archiveDate, format);
        const aaData = formatData(format, appActions);
        archive.addBuffer(Buffer.from(aaData), path.join(rootName, appActionsFilename));

        const appDataFilename = buildActionFileName('app_data', archiveDate, format);
        const adData = formatData(format, appData);
        archive.addBuffer(Buffer.from(adData), path.join(rootName, appDataFilename));

        const appSettingsFilename = buildActionFileName('app_settings', archiveDate, format);
        const asData = formatData(format, appSettings);
        archive.addBuffer(Buffer.from(asData), path.join(rootName, appSettingsFilename));

        break;
      }
    }
  } catch (e) {
    console.error(e);
    throw new CannotWriteFileError(e);
  }

  archive.end();

  return archive;
};
