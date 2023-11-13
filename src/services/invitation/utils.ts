import * as Papa from 'papaparse';

import { BusboyFileStream } from '@fastify/busboy';

import { PermissionLevel } from '@graasp/sdk';

export type CSVInvite = {
  email: string;
  name?: string;
  group_name?: string;
  permission?: PermissionLevel;
};

export const getCSV = (
  stream: BusboyFileStream,
): Promise<{ rows: CSVInvite[]; header: string[] }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(stream, {
      header: true,
      dynamicTyping: false,
      complete(results) {
        resolve({
          rows: results.data as CSVInvite[],
          header: results.meta.fields,
        });
      },
      error(err) {
        reject(err);
      },
    });
  });
};

export const regexGenFirstLevelItems = (firstLvlPath: string) => {
  return RegExp(`${firstLvlPath}\.[a-zA-Z0-9_]+$`);
};
