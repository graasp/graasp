import extract from 'extract-zip';
import { createWriteStream } from 'fs';
import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream';
import util from 'util';
import { v4 } from 'uuid';

import { BusboyFileStream } from '@fastify/busboy';

import { ItemType } from '@graasp/sdk';

import { Item } from '../../entities/Item';
import {
  APP_URL_PREFIX,
  DESCRIPTION_EXTENSION,
  GRAASP_DOCUMENT_EXTENSION,
  LINK_EXTENSION,
  TMP_IMPORT_ZIP_FOLDER_PATH,
  URL_PREFIX,
} from './constants';

const pump = util.promisify(pipeline);

export const prepareZip = async (file: BusboyFileStream) => {
  // read and prepare folder for zip and content
  const tmpId = v4();
  const targetFolder = path.join(TMP_IMPORT_ZIP_FOLDER_PATH, tmpId);
  await mkdir(targetFolder, { recursive: true });
  const zipPath = path.join(targetFolder, `${tmpId}.zip`);
  const folderPath = path.join(targetFolder, 'content');

  // save graasp zip
  await pump(file, createWriteStream(zipPath));
  await extract(zipPath, { dir: folderPath });

  return { folderPath };
};

// build the file content in case of Link/App
export const buildTextContent = (url: string, type: ItemType): string => {
  if (type === ItemType.LINK) {
    return `[InternetShortcut]\n${URL_PREFIX}${url}\n`;
  }
  return `[InternetShortcut]\n${URL_PREFIX}${url}\n${APP_URL_PREFIX}1\n`;
};

export const setDescriptionInItem = ({
  filename,
  content,
  items,
  extention,
}: {
  filename: string;
  content: string;
  items: Partial<Item>[];
  extention: string;
}) => {
  const name = filename.slice(0, -extention.length);
  const item = items.find(({ name: thisName }) => name === thisName);
  if (item) {
    item.description = content;
  } else {
    console.error(`Cannot find item with name ${name}`);
  }
};

/**
 * Read file description, and set its content in correpsonding item in items array
 * @param options
 */
export const handleItemDescription = async (options: {
  filename: string;
  filepath: string;
  folderName: string;
  items: Partial<Item>[];
  updateParentDescription: (description: string) => Promise<unknown | void>;
}): Promise<void> => {
  const { filename, items, filepath, folderName, updateParentDescription } = options;

  // string content
  // todo: optimize to avoid reading the file twice in case of upload
  const content = await readFile(filepath, {
    encoding: 'utf8',
    flag: 'r',
  });

  switch (true) {
    // parent folder description
    case filename === `${folderName}${DESCRIPTION_EXTENSION}`: {
      await updateParentDescription(content);
      break;
    }
    // links description
    case filename.endsWith(`${LINK_EXTENSION}${DESCRIPTION_EXTENSION}`): {
      setDescriptionInItem({
        filename,
        content,
        items,
        extention: `${LINK_EXTENSION}${DESCRIPTION_EXTENSION}`,
      });
      break;
    }
    // documents description
    case filename.endsWith(`${GRAASP_DOCUMENT_EXTENSION}${DESCRIPTION_EXTENSION}`): {
      setDescriptionInItem({
        filename,
        content,
        items,
        extention: `${GRAASP_DOCUMENT_EXTENSION}${DESCRIPTION_EXTENSION}`,
      });
      break;
    }
    // files and folders description
    case filename.endsWith(DESCRIPTION_EXTENSION): {
      setDescriptionInItem({ filename, content, items, extention: DESCRIPTION_EXTENSION });
      break;
    }
    default: {
      console.error(`${filepath} is not handled`);
    }
  }
};
