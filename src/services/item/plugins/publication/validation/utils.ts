import path from 'path';
import striptags from 'striptags';

import { MimeTypes, getMimetype } from '@graasp/sdk';

import { type ItemRaw } from '../../../../../drizzle/types';
import { TMP_FOLDER } from '../../../../../utils/config';
import { type FileItem, isItemType } from '../../../discrimination';

export const stripHtml = (str?: string | null): string => (str ? striptags(str) : '');

export const buildStoragePath = (itemId: string): string =>
  path.join(TMP_FOLDER, 'validations', itemId);

export const isFileType = (item: ItemRaw) => {
  return isItemType(item, 'file');
};

export const isImage = (item: ItemRaw): item is FileItem => {
  if (!isFileType(item)) {
    return false;
  }

  const mimetype = getMimetype(item.extra);

  if (!mimetype) {
    return false;
  }

  return MimeTypes.isImage(mimetype);
};
