import { WriteStream } from 'fs';
import sharp from 'sharp';

import { THUMBNAIL_FORMAT, ThumbnailSizeFormat } from './constants';

export const createThumbnails = async (s: WriteStream) => {
  // generate sizes for given image
  const files: { sizeName: string; fileStream: WriteStream }[] = [];
  await Promise.all(
    Object.entries(ThumbnailSizeFormat).map(async ([sizeName, width]) => {
      const pipeline = sharp();
      const thumbnailStream = pipeline.resize({ width }).toFormat(THUMBNAIL_FORMAT).pipe(s);

      files.push({
        sizeName,
        fileStream: thumbnailStream,
      });
    }),
  );
  return files;
};
