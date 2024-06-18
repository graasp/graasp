import path from 'path';
import striptags from 'striptags';

import { TMP_FOLDER } from '../../../../utils/config.js';

export const stripHtml = (str?: string | null): string => (str ? striptags(str) : '');

export const buildStoragePath = (itemId: string): string =>
  path.join(TMP_FOLDER, 'validations', itemId);
