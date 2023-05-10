export const PLUGIN_NAME = 'graasp-plugin-actions';

// Constants to check the validity of the query parameters when obtaining actions
export const DEFAULT_ACTIONS_SAMPLE_SIZE = 5000;
export const MIN_ACTIONS_SAMPLE_SIZE = 0;
export const MAX_ACTIONS_SAMPLE_SIZE = 10000;

export const ZIP_MIMETYPE = 'application/zip';

export const DEFAULT_REQUEST_EXPORT_INTERVAL = 3600 * 1000 * 24; // 1 day - used for timestamp
export const EXPORT_FILE_EXPIRATION_DAYS = 7;
export const EXPORT_FILE_EXPIRATION = 3600 * 24 * EXPORT_FILE_EXPIRATION_DAYS; // max value: one week
