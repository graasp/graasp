import path from 'path';
import striptags from 'striptags';

import { MimeTypes, getMimetype } from '@graasp/sdk';

import { FileItem, type ItemRaw, isFileItemDTO } from '../../../../../drizzle/item.dto';
import { TMP_FOLDER } from '../../../../../utils/config';

export const stripHtml = (str?: string | null): string => (str ? striptags(str) : '');

export const buildStoragePath = (itemId: string): string =>
  path.join(TMP_FOLDER, 'validations', itemId);

export const isImage = (item: ItemRaw): item is FileItem => {
  if (!isFileItemDTO(item)) {
    return false;
  }

  const mimetype = getMimetype(item.extra);

  if (!mimetype) {
    return false;
  }

  return MimeTypes.isImage(mimetype);
};
