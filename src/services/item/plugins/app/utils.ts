import path from 'path';

import { PATH_PREFIX } from './constants';
import { TokenItemIdMismatch } from './errors';

export const checkTargetItemAndTokenItemMatch = (itemId1: string, itemId2: string): void => {
  if (itemId1 !== itemId2) {
    throw new TokenItemIdMismatch();
  }
};

export const buildFileItemData = ({ name, type, filename, filepath, size, mimetype }) => ({
  name,
  type,
  extra: {
    [type]: {
      name: filename,
      path: filepath,
      size,
      mimetype,
    },
  },
});
