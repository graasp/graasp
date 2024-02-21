export const PLUGIN_NAME = 'graasp-plugin-item-actions';

export enum ItemActionType {
  Update = 'update',
  Create = 'create',
  Delete = 'delete',
  Copy = 'copy',
  Move = 'move',
}

export const ZIP_MIMETYPE = 'application/zip';

export const DEFAULT_REQUEST_EXPORT_INTERVAL = 3600 * 1000 * 24; // 1 day - used for timestamp
export const EXPORT_FILE_EXPIRATION_DAYS = 7;
export const EXPORT_FILE_EXPIRATION = 3600 * 24 * EXPORT_FILE_EXPIRATION_DAYS; // max value: one week
