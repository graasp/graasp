import { ReadStream } from 'fs';

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

  getFile(args: { filepath: string; id: string }): Promise<ReadStream>;

  getUrl(args: {
    filepath: string;
    // used by s3 to set an expiry link on signed url
    expiration?: number;
    // used by local to log
    id?: string;
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
