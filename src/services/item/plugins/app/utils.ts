import { TokenItemIdMismatch } from './errors';

export const checkTargetItemAndTokenItemMatch = (itemId1: string, itemId2: string): void => {
  if (itemId1 !== itemId2) {
    throw new TokenItemIdMismatch();
  }
};

export const buildFileItemData = ({
  name,
  type,
  filename,
  filepath,
  size,
  mimetype,
}: {
  name: string;
  type: string;
  filename: string;
  filepath: string;
  size: number;
  mimetype: string;
}) => ({
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
