import extract from 'extract-zip';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import mime from 'mime-types';
import path from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { v4 } from 'uuid';

import { BusboyFileStream } from '@fastify/busboy';
import { FastifyBaseLogger } from 'fastify';

import { ItemType, ItemTypeUnion, UnionOfConst } from '@graasp/sdk';

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

const extractFileName = (itemName: string, extension: string) => {
  const fullExtension = `.${extension}`;
  const fileName = `${path.basename(itemName, fullExtension)}`;
  return `${fileName}${fullExtension}`;
};

const extractExtension = ({ name, mimetype }: { name: string; mimetype?: string }): string => {
  // slice to remove . character
  const ext = path.extname(name).slice(1);
  if (!ext && mimetype) {
    return mime.extension(mimetype) || '';
  }
  return ext;
};

// use partial of item to be usable in backend
export const getFilenameFromItem = (item: {
  name: string;
  type: ItemTypeUnion;
  mimetype?: string;
}): string => {
  switch (item.type) {
    case ItemType.APP: {
      return extractFileName(item.name, 'app');
    }
    case ItemType.DOCUMENT: {
      if (item.mimetype === 'text/html') {
        return extractFileName(item.name, 'html');
      }
      return extractFileName(item.name, 'graasp');
    }
    case ItemType.S3_FILE:
    case ItemType.LOCAL_FILE: {
      return extractFileName(
        item.name,
        extractExtension({ name: item.name, mimetype: item.mimetype }),
      );
    }
    case ItemType.FOLDER: {
      return extractFileName(item.name, 'zip');
    }
    case ItemType.H5P: {
      return extractFileName(item.name, 'h5p');
    }
    case ItemType.LINK: {
      return extractFileName(item.name, 'url');
    }
    default:
      return item.name;
  }
};
