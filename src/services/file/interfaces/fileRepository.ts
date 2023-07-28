import { ReadStream } from 'fs';
import { Stream } from 'stream';

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

  downloadFile(args: {
    reply?: FastifyReply;
    filepath: string;
    mimetype?: string;
    fileStorage?: string;
    expiration?: number;
    replyUrl?: boolean;
    id: string;
    encoding?: BufferEncoding;
  }): Promise<ReadStream | string | void>;

  uploadFile(args: {
    fileStream: ReadableStream;
    memberId: string;
    filepath: string;
    mimetype?: string;
    size?: string;
  }): Promise<void>;
  // eslint-disable-next-line semi
}
