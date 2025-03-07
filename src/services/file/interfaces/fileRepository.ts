import { Readable } from 'stream';

import { FastifyBaseLogger } from 'fastify';

import { FileItemType } from '@graasp/sdk';

export type FileUpload = {
  fileStream: Readable;
  memberId: string;
  filepath: string;
  mimetype?: string;
  size?: string;
};

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

  deleteFile(filepath: string): Promise<void>;
  deleteFiles(filepaths: string[]): Promise<void>;
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

  uploadFile(file: FileUpload): Promise<void>;

  uploadFiles(files: FileUpload[]): Promise<void>;
}
