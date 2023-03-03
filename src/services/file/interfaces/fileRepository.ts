import { ReadStream } from 'fs';

import { FastifyReply } from 'fastify';

export interface FileRepository {
  copyFile(args: {
    newId: string;
    memberId: string;
    originalPath: string;
    newFilePath: string;
    mimetype: string;
  }): Promise<string>;

  copyFolder(args: { originalFolderPath: string; newFolderPath: string }): Promise<string>;

  deleteFile(args: { filepath: string }): Promise<void>;
  deleteFolder(args: { folderPath: string }): Promise<void>;

  downloadFile(args: {
    reply?: FastifyReply;
    filepath: string;
    itemId: string;
    mimetype?: string;
    fileStorage?: string;
    expiration?: number;
    replyUrl?: boolean;
  }): Promise<ReadStream | string | void>;

  uploadFile(args: {
    fileStream: ReadStream;
    memberId: string;
    filepath: string;
    mimetype: string;
    size?: string;
  }): Promise<void>;
  // eslint-disable-next-line semi
}
