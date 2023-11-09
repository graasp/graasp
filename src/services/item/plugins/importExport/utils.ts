import extract from 'extract-zip';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { v4 } from 'uuid';

import { BusboyFileStream } from '@fastify/busboy';
import { FastifyBaseLogger } from 'fastify';

import { ItemType, UnionOfConst } from '@graasp/sdk';

import { APP_URL_PREFIX, TMP_IMPORT_ZIP_FOLDER_PATH, URL_PREFIX } from './constants';

export const prepareZip = async (file: BusboyFileStream, log?: FastifyBaseLogger) => {
  // read and prepare folder for zip and content
  const tmpId = v4();
  const targetFolder = path.join(TMP_IMPORT_ZIP_FOLDER_PATH, tmpId);
  await mkdir(targetFolder, { recursive: true });
  const zipPath = path.join(targetFolder, `${tmpId}.zip`);
  const folderPath = path.join(targetFolder, 'content');

  // save graasp zip
  const result = createWriteStream(zipPath, { flags: 'a' });

  let totalBytes = 0;
  await pipeline(
    file,
    new Transform({
      transform(chunk, encoding, callback) {
        totalBytes += chunk.length;
        log?.debug(`totalBytes ${totalBytes}`);
        this.push(chunk);
        callback();
      },
    }),
    result,
  );

  await extract(zipPath, { dir: folderPath });

  return { folderPath, targetFolder };
};

// build the file content in case of Link/App
export const buildTextContent = (url: string, type: UnionOfConst<typeof ItemType>): string => {
  if (type === ItemType.LINK) {
    return `[InternetShortcut]\n${URL_PREFIX}${url}\n`;
  }
  return `[InternetShortcut]\n${URL_PREFIX}${url}\n${APP_URL_PREFIX}1\n`;
};
