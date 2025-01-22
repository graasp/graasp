import path from 'path';
import striptags from 'striptags';

import { ItemType, MimeTypes, getMimetype } from '@graasp/sdk';

import { TMP_FOLDER } from '../../../../../utils/config';
import { Item, isItemType } from '../../../entities/Item';

export const stripHtml = (str?: string | null): string => (str ? striptags(str) : '');

export const buildStoragePath = (itemId: string): string =>
  path.join(TMP_FOLDER, 'validations', itemId);

export const isFileType = (item: Item) => {
  return isItemType(item, ItemType.S3_FILE) || isItemType(item, ItemType.LOCAL_FILE);
};

export const isImage = (item: Item): item is Item<'s3File'> | Item<'file'> => {
  if (!isFileType(item)) {
    return false;
  }

  const mimetype = getMimetype(item.extra);

  if (!mimetype) {
    return false;
  }

  return MimeTypes.isImage(mimetype);
};
