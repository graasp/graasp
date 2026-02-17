import extract from 'extract-zip';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import mime from 'mime';
import path from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { v4 } from 'uuid';

import type { FastifyBaseLogger } from 'fastify';

import { FileItemExtra, getMimetype } from '@graasp/sdk';

import { ItemType } from '../../../../schemas/global';
import {
  type ItemRaw,
  isAppItem,
  isDocumentItem,
  isEmbeddedLinkItem,
  isEtherpadItem,
  isFileItem,
  isFolderItem,
  isH5PItem,
} from '../../item';
import { APP_URL_PREFIX, TMP_IMPORT_ZIP_FOLDER_PATH, URL_PREFIX } from './constants';

export const prepareZip = async (file: Readable, log?: FastifyBaseLogger) => {
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
export const buildTextContent = (url: string, type: ItemType): string => {
  if (type === 'embeddedLink') {
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
    return mime.getExtension(mimetype) || '';
  }
  return ext;
};

export const getFilenameFromItem = (item: ItemRaw): string => {
  switch (true) {
    case isAppItem(item): {
      return extractFileName(item.name, 'app');
    }
    case isDocumentItem(item): {
      return extractFileName(item.name, 'html');
    }
    case isFileItem(item): {
      // bug: we need to cast because of mismatch with sdk
      const mimetype = getMimetype(item.extra as FileItemExtra);
      return extractFileName(item.name, extractExtension({ name: item.name, mimetype }));
    }
    case isFolderItem(item): {
      return extractFileName(item.name, 'zip');
    }
    case isH5PItem(item): {
      return extractFileName(item.name, 'h5p');
    }
    case isEmbeddedLinkItem(item): {
      return extractFileName(item.name, 'url');
    }
    case isEtherpadItem(item): {
      return extractFileName(item.name, 'html');
    }
    default:
      return item.name;
  }
};

export const generateThumbnailFilename = (id: string): string => {
  return `${id}-thumbnail`;
};
