import { Readable } from 'node:stream';
import { parse } from 'papaparse';

import type { MultipartFile } from '@fastify/multipart';

import type { PermissionLevel } from '../../../../../types';
import { CSV_MIMETYPE, EMAIL_COLUMN_NAME } from './constants';

export type CSVInvite = {
  email: string;
  name?: string;
  group_name?: string;
  permission?: PermissionLevel;
};

export const parseCSV = (stream: Readable): Promise<{ rows: CSVInvite[]; header: string[] }> => {
  return new Promise((resolve, reject) => {
    parse<CSVInvite>(stream, {
      // get the headers from the file
      header: true,
      // do not try to convert the values to other types (everything will be a string)
      dynamicTyping: false,
      // needed in order to support spaes in the header
      transformHeader(header) {
        return header.trim().toLowerCase();
      },
      // trim each value, and additionaly lowercase the email column
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
      error(err: Error) {
        reject(err);
      },
    });
  });
};

export const verifyCSVFileFormat = (file: MultipartFile) => {
  // is this check sufficient ? the mimetype coud be forged...
  if (file.mimetype != CSV_MIMETYPE) {
    throw new Error(
      'An incorrect type of file has been uploaded. Please upload a file with .csv extension.',
    );
  }
};
