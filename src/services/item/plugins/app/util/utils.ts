import path from 'path';

import { PATH_PREFIX } from './constants';
import { TokenItemIdMismatch } from './graasp-apps-error';

export const checkTargetItemAndTokenItemMatch = (itemId1: string, itemId2: string): void => {
  if (itemId1 !== itemId2) {
    throw new TokenItemIdMismatch();
  }
};

// export const buildFilePath = () => {
//   const filepath = `${randomHexOf4()}/${randomHexOf4()}/${randomHexOf4()}-${Date.now()}`;
//   return path.join(PATH_PREFIX, filepath);
// };

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
