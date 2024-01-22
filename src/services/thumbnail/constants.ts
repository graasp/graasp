import { MimeTypes, ThumbnailSize } from '@graasp/sdk';

export const ThumbnailSizeFormat = {
  /**
   * For use in Avatars, thumbnails in table etc
   */
  [ThumbnailSize.Small]: 40,
  /**
   * For use in library cards, builder grid view, etc
   */
  [ThumbnailSize.Medium]: 256,
  /**
   * For use when the image is the main focus, in the summary of the library for example
   */
  [ThumbnailSize.Large]: 512,
  [ThumbnailSize.Original]: undefined,
};

export const THUMBNAIL_FORMAT = 'webp';
export const THUMBNAIL_MIMETYPE = MimeTypes.Image.WEBP;

export const PLUGIN_NAME = 'graasp-plugin-thumbnails';
