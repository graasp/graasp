import path from 'path';

import { TMP_FOLDER } from '../../../../utils/config';

export const PLUGIN_NAME = 'graasp-plugin-item-zip';

export const TMP_IMPORT_ZIP_FOLDER_PATH = path.join(TMP_FOLDER, 'zip-import');

export const ROOT_PATH = './';

export const GRAASP_MANIFEST_FILENAME = 'graasp-manifest.json';

export const GRAASP_ARCHIVE_THUMBNAIL_SUFFIX = '-thumbnail';

export const DESCRIPTION_EXTENSION = '.description.html';

export const GRAASP_DOCUMENT_EXTENSION = '.graasp';
export const LINK_EXTENSION = '.url';
export const HTML_EXTENSION = '.html';
export const TXT_EXTENSION = '.txt';

export const ZIP_FILE_MIME_TYPES = [
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
];

export const H5P_FILE_EXTENSION = '.h5p';

export const URL_PREFIX = 'URL=';
export const APP_URL_PREFIX = 'AppURL=';
