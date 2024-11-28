import { Readable } from 'stream';

import { FastifyBaseLogger } from 'fastify';

import { FileItemType } from '@graasp/sdk';

export interface FileRepository {
  get fileType(): FileItemType;

  getFileSize(filepath: string): Promise<number | undefined>;

  copyFile(args: {
    newId?: string;
    memberId: string;
    originalPath: string;
    newFilePath: string;
    mimetype?: string;
  }): Promise<string>;

  copyFolder(args: { originalFolderPath: string; newFolderPath: string }): Promise<string>;

  deleteFile(args: { filepath: string }): Promise<void>;
  deleteFolder(args: { folderPath: string }): Promise<void>;

  getFile(args: { filepath: string; id: string }, log?: FastifyBaseLogger): Promise<Readable>;

  getUrl(
    args: {
      filepath: string;
      // used by s3 to set an expiry link on signed url
      expiration?: number;
    },
    log?: FastifyBaseLogger,
  ): Promise<string>;

  uploadFile(args: {
    fileStream: Readable;
    memberId: string;
    filepath: string;
    mimetype?: string;
    size?: string;
  }): Promise<void>;
}
