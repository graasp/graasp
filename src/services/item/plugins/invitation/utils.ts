import { Readable } from 'node:stream';
import Papa from 'papaparse';

import { MultipartFile } from '@fastify/multipart';

import { PermissionLevel } from '@graasp/sdk';

import { CSV_MIMETYPE, EMAIL_COLUMN_NAME } from './constants';

export type CSVInvite = {
  email: string;
  name?: string;
  group_name?: string;
  permission?: PermissionLevel;
};

export const parseCSV = (stream: Readable): Promise<{ rows: CSVInvite[]; header: string[] }> => {
  return new Promise((resolve, reject) => {
    Papa.parse<CSVInvite>(stream, {
      header: true,
      dynamicTyping: false,
      transformHeader(header) {
        return header.trim().toLowerCase();
      },
      transform(value, header) {
        if (header === EMAIL_COLUMN_NAME) {
          return value.trim().toLowerCase();
        }
        return value.trim();
      },
      complete(results) {
        resolve({
          rows: results.data,
          header: results.meta.fields ?? [],
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
