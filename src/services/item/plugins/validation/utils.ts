import path from 'path';
import striptags from 'striptags';

import { TMP_FOLDER } from '../../../../utils/config';

export const stripHtml = (str: string): string => striptags(str);

export const buildStoragePath = (itemId: string): string =>
  path.join(TMP_FOLDER, 'validations', itemId);
