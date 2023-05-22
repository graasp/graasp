import { ReadStream } from 'fs';

import { ItemType } from '@graasp/sdk';

import { Member } from '../member/entities/member';
import { LocalFileRepository } from './repositories/local';
import { S3FileRepository } from './repositories/s3';
import FileService from './service';
import {
  CopyFileInvalidPathError,
  CopyFolderInvalidPathError,
  DeleteFileInvalidPathError,
  DeleteFolderInvalidPathError,
  UploadFileUnexpectedError,
} from './utils/errors';

const MOCK_LOCAL_CONFIG = {
  storageRootPath: 'root-path',
};

const MOCK_S3_CONFIG = {
  s3Region: 'string',
  s3Bucket: 'string',
  s3AccessKeyId: 'string',
  s3SecretAccessKey: 'string',
};

const member = new Member();

const S3FS = new FileService({ s3: MOCK_S3_CONFIG }, ItemType.S3_FILE);

describe('FileService', () => {
  describe('constructor', () => {
    it('use s3 repository', () => {
      const fS = S3FS;
      expect(fS.repository).toBeInstanceOf(S3FileRepository);
    });
    it('use local repository', () => {
      const fS = new FileService({ local: MOCK_LOCAL_CONFIG }, ItemType.LOCAL_FILE);
      expect(fS.repository).toBeInstanceOf(LocalFileRepository);
    });
    it('throws for conflicting settings', () => {
      expect(() => {
        new FileService({ s3: MOCK_S3_CONFIG }, ItemType.LOCAL_FILE);
      }).toThrowError();

      expect(() => {
        new FileService({ local: MOCK_LOCAL_CONFIG }, ItemType.S3_FILE);
      }).toThrowError();
    });
  });

  describe('upload', () => {
    const uploadPayload = { file: {} as unknown as ReadStream, size: 10, filepath: 'filepath' };

    it('upload successfully', async () => {
      const fS = S3FS;
      const uploadFileMock = jest
        .spyOn(fS.repository, 'uploadFile')
        .mockImplementation(async () => {
          // do nothing
        });
      expect((await fS.upload(member, uploadPayload)).file).toBeTruthy();
      expect(uploadFileMock).toHaveBeenCalled();
    });

    it('upload failure will delete file', async () => {
      const fS = S3FS;
      const uploadFileMock = jest.spyOn(fS.repository, 'uploadFile').mockRejectedValue('error');
      const deleteFileMock = jest
        .spyOn(fS.repository, 'deleteFile')
        .mockImplementation(async () => {
          // do nothing
        });
      await expect(fS.upload(member, uploadPayload)).rejects.toMatchObject(
        new UploadFileUnexpectedError(expect.anything()),
      );
      expect(uploadFileMock).toHaveBeenCalled();
      expect(deleteFileMock).toHaveBeenCalled();
    });
  });

  describe('download', () => {
    const downloadPayload = { path: 'filepath', id: 'id' };

    it('download successfully', async () => {
      const fS = S3FS;
      const returnValue = 'value';
      const downloadMock = jest
        .spyOn(fS.repository, 'downloadFile')
        .mockImplementation(async () => returnValue);
      expect(await fS.download(member, downloadPayload)).toBeTruthy();
      expect(downloadMock).toHaveBeenCalled();
    });

    it('signed out member can download', async () => {
      const fS = S3FS;
      const returnValue = 'value';
      const downloadMock = jest
        .spyOn(fS.repository, 'downloadFile')
        .mockImplementation(async () => returnValue);
      expect(await fS.download(undefined, downloadPayload)).toBeTruthy();
      expect(downloadMock).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('delete successfully', async () => {
      const fS = S3FS;
      const deleteMock = jest.spyOn(fS.repository, 'deleteFile').mockImplementation(async () => {
        // do nothing
      });
      await fS.delete(member, 'filepath');
      expect(deleteMock).toHaveBeenCalled();
    });

    it('empty path throws', async () => {
      const fS = S3FS;
      await expect(fS.delete(member, '')).rejects.toMatchObject(
        new DeleteFileInvalidPathError(expect.anything()),
      );
    });
  });

  describe('deleteFolder', () => {
    it('delete successfully', async () => {
      const fS = S3FS;
      const deleteMock = jest.spyOn(fS.repository, 'deleteFolder').mockImplementation(async () => {
        // do nothing
      });
      await fS.deleteFolder(member, 'filepath');
      expect(deleteMock).toHaveBeenCalled();
    });

    it('empty path throws', async () => {
      const fS = S3FS;
      await expect(fS.deleteFolder(member, '')).rejects.toMatchObject(
        new DeleteFolderInvalidPathError(expect.anything()),
      );
    });
  });

  describe('copy', () => {
    const copyPayload = {
      newFilePath: 'string',
      originalPath: 'string',
    };

    it('copy successfully', async () => {
      const fS = S3FS;
      const copyMock = jest
        .spyOn(fS.repository, 'copyFile')
        .mockImplementation(async () => 'string');
      await fS.copy(member, copyPayload);
      expect(copyMock).toHaveBeenCalled();
    });

    it('empty originalPath throws', async () => {
      const fS = S3FS;
      await expect(fS.copy(member, { ...copyPayload, originalPath: '' })).rejects.toMatchObject(
        new CopyFileInvalidPathError(expect.anything()),
      );
    });

    it('empty newFilePath throws', async () => {
      const fS = S3FS;
      await expect(fS.copy(member, { ...copyPayload, newFilePath: '' })).rejects.toMatchObject(
        new CopyFileInvalidPathError(expect.anything()),
      );
    });
  });

  describe('copyFolder', () => {
    const copyPayload = {
      newFolderPath: 'string',
      originalFolderPath: 'string',
    };

    it('copy folder successfully', async () => {
      const fS = S3FS;
      const copyMock = jest
        .spyOn(fS.repository, 'copyFolder')
        .mockImplementation(async () => 'string');
      await fS.copyFolder(member, copyPayload);
      expect(copyMock).toHaveBeenCalled();
    });

    it('empty originalFolderPath throws', async () => {
      const fS = S3FS;
      await expect(
        fS.copyFolder(member, { ...copyPayload, originalFolderPath: '' }),
      ).rejects.toMatchObject(new CopyFolderInvalidPathError(expect.anything()));
    });

    it('empty newFolderPath throws', async () => {
      const fS = S3FS;
      await expect(
        fS.copyFolder(member, { ...copyPayload, newFolderPath: '' }),
      ).rejects.toMatchObject(new CopyFolderInvalidPathError(expect.anything()));
    });
  });
});
