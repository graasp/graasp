import { createHash } from 'crypto';
import fs, { ReadStream } from 'fs';
import path from 'path';
import sharp from 'sharp';

import { THUMBNAILS_PATH_PREFIX } from '../../../../../util/config';
import { THUMBNAIL_FORMAT, THUMBNAIL_SIZES } from './constants';
import { UndefinedItemError } from './errors';

export const hash = (id: string): string => createHash('sha256').update(id).digest('hex');

export const buildFilePathFromId = (id: string): string =>
  hash(id)
    .match(/.{1,8}/g)
    .join('/');

// used for download in public plugin
export const buildFilePathWithPrefix = (options: {
  itemId: string;
  pathPrefix: string;
  filename: string;
}): string => {
  const { itemId, filename, pathPrefix } = options;
  if (!itemId) {
    throw new UndefinedItemError({ itemId, filename });
  }
  const filepath = buildFilePathFromId(itemId);
  return path.join(THUMBNAILS_PATH_PREFIX, pathPrefix, filepath, filename);
};

export const buildThumbnailPath = (name, itemId, folderPath) => `${folderPath}/${itemId}-${name}`;

export const createThumbnails = async (imagePath: string, itemId: string, folderPath: string) => {
  // generate sizes for given image
  const files: { name: string; size: number; fileStream: ReadStream }[] = [];
  await Promise.all(
    Object.entries(THUMBNAIL_SIZES).map(async ([name, width]) => {
      // save resize image in tmp folder
      const filepath = buildThumbnailPath(name, itemId, folderPath);
      const pipeline = sharp(imagePath).resize({ width }).raw().toFormat(THUMBNAIL_FORMAT);
      console.log(name, width, filepath);
      await pipeline.toFile(filepath);
      files.push({
        name,
        fileStream: fs.createReadStream(filepath),
        size: fs.statSync(filepath).size,
      });
    }),
  );

  return files;
};
