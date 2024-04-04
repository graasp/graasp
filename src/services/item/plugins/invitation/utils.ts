import * as Papa from 'papaparse';

import { BusboyFileStream } from '@fastify/busboy';
import { MultipartFile } from '@fastify/multipart';

import { PermissionLevel } from '@graasp/sdk';

import { CSV_MIMETYPE } from './constants';

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

export const verifyCSVFileFormat = (file: MultipartFile) => {
  // is this check sufficient ? the mimetype coud be forged...
  if (file.mimetype != CSV_MIMETYPE) {
    throw new Error(`
        An incorrect type of file has been uploaded,
        Please upload a file with .csv extension
      `);
  }
};
