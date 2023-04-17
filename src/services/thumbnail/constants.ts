import { MimeTypes, ThumbnailSize } from '@graasp/sdk';

export const ThumbnailSizeFormat = {
  [ThumbnailSize.Small]: 200,
  [ThumbnailSize.Medium]: 400,
  [ThumbnailSize.Large]: 600,
  [ThumbnailSize.Original]: undefined,
};

export const THUMBNAIL_FORMAT = 'jpeg';
export const THUMBNAIL_MIMETYPE = MimeTypes.Image.JPEG;

export const PLUGIN_NAME = 'graasp-plugin-thumbnails';
