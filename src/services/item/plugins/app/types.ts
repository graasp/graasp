import { FileItemType } from '@graasp/sdk';

export interface AppsPluginOptions {
  jwtSecret: string;
  /** In minutes. Defaults to 30 (minutes) */
  jwtExpiration?: number;

  fileItemType: FileItemType;
  thumbnailsPrefix: string;
  publisherId: string;
}
