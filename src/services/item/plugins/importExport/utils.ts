import extract from 'extract-zip';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import mime from 'mime';
import path from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { v4 } from 'uuid';

import type { FastifyBaseLogger } from 'fastify';

import { ItemType, type UnionOfConst, getMimetype } from '@graasp/sdk';

import { type ItemRaw } from '../../../../drizzle/types';
import { isItemType } from '../../discrimination';
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
    return mime.getExtension(mimetype) || '';
  }
  return ext;
};

export const getFilenameFromItem = (item: ItemRaw): string => {
  switch (true) {
    case isItemType(item, ItemType.APP): {
      return extractFileName(item.name, 'app');
    }
    case isItemType(item, ItemType.DOCUMENT): {
      return extractFileName(item.name, 'html');
    }
    case isItemType(item, ItemType.FILE): {
      const mimetype = getMimetype(item.extra);
      return extractFileName(item.name, extractExtension({ name: item.name, mimetype }));
    }
    case isItemType(item, ItemType.FOLDER): {
      return extractFileName(item.name, 'zip');
    }
    case isItemType(item, ItemType.H5P): {
      return extractFileName(item.name, 'h5p');
    }
    case isItemType(item, ItemType.LINK): {
      return extractFileName(item.name, 'url');
    }
    case isItemType(item, ItemType.ETHERPAD): {
      return extractFileName(item.name, 'html');
    }
    default:
      return item.name;
  }
};

export const generateThumbnailFilename = (id: string): string => {
  return `${id}-thumbnail`;
};
