import fs, { ReadStream } from 'fs';
import sharp from 'sharp';

import { UUID } from '@graasp/sdk';

import { THUMBNAIL_FORMAT, ThumbnailSizeFormat } from './constants';

const buildThumbnailPath = (name: string, itemId: UUID, folderPath: string) =>
  `${folderPath}/${itemId}-${name}`;

export const createThumbnails = async (imagePath: string, itemId: string, folderPath: string) => {
  // generate sizes for given image
  const files: { sizeName: string; size: number; fileStream: ReadStream }[] = [];
  await Promise.all(
    Object.entries(ThumbnailSizeFormat).map(async ([sizeName, width]) => {
      // save resize image in tmp folder
      const filepath = buildThumbnailPath(sizeName, itemId, folderPath);
      const pipeline = sharp(imagePath).resize({ width }).raw().toFormat(THUMBNAIL_FORMAT);
      await pipeline.toFile(filepath);
      files.push({
        sizeName,
        fileStream: fs.createReadStream(filepath),
        size: fs.statSync(filepath).size,
      });
    }),
  );

  return files;
};
