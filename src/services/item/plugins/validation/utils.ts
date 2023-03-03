import path from 'path';
import striptags from 'striptags';

export const stripHtml = (str: string): string => striptags(str);

export const buildStoragePath = (itemId: string): string => path.join(__dirname, itemId);
