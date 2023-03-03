export enum ThumbnailSize {
  Small = 'small',
  Medium = 'medium',
  Large = 'large',
  Original = 'original',
}

export const THUMBNAIL_SIZES = {
  [ThumbnailSize.Small]: 200,
  [ThumbnailSize.Medium]: 400,
  [ThumbnailSize.Large]: 600,
  [ThumbnailSize.Original]: undefined,
};

export const THUMBNAIL_FORMAT = 'jpeg';
export const THUMBNAIL_MIMETYPE = 'image/jpeg';

export const AVATARS_ROUTE = '/avatars';
export const THUMBNAIL_ROUTE = '/thumbnails';
export const MEMBERS_ROUTE = '/members';
export const ITEMS_ROUTE = '/items';

export const TMP_FOLDER = './tmp';
export const PLUGIN_NAME = 'graasp-plugin-thumbnails';
