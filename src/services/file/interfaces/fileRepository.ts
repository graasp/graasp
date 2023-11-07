import { ReadStream } from 'fs';

import { FastifyReply } from 'fastify';

export interface FileRepository {
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

  getFile(args: {
    filepath: string;
    id: string;
    fileStorage?: string; // s3 only
    expiration?: number; // s3 only
  }): Promise<ReadStream>;

  getUrl(args: {
    filepath: string;
    expiration?: number; // s3 only - for export
    id: string; // local only
  }): Promise<string>;

  uploadFile(args: {
    fileStream: ReadableStream;
    memberId: string;
    filepath: string;
    mimetype?: string;
    size?: string;
  }): Promise<void>;
  // eslint-disable-next-line semi
}
