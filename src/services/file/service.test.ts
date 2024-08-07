import { ReadStream } from 'fs';

import { ItemType } from '@graasp/sdk';

import { BaseLogger } from '../../logger';
import { Member } from '../member/entities/member';
import { LocalFileRepository } from './repositories/local';
import { S3FileRepository } from './repositories/s3';
import FileService from './service';
import {
  CopyFileInvalidPathError,
  CopyFolderInvalidPathError,
  DeleteFileInvalidPathError,
  DeleteFolderInvalidPathError,
  MalformedFileConfigError,
  UploadFileUnexpectedError,
} from './utils/errors';
import { fileRepositoryFactory } from './utils/factory';

const MOCK_LOCAL_CONFIG = {
  storageRootPath: '/root-path',
  localFilesHost: 'http://localhost',
};

const MOCK_S3_CONFIG = {
  s3Region: 'string',
  s3Bucket: 'string',
  s3AccessKeyId: 'string',
  s3SecretAccessKey: 'string',
};

const member = new Member();

const s3Repository = fileRepositoryFactory(ItemType.S3_FILE, { s3: MOCK_S3_CONFIG });

const s3FileService = new FileService(s3Repository, console as unknown as BaseLogger);

describe('FileService', () => {
  describe('constructor', () => {
    it('use s3 repository', () => {
      expect(s3Repository).toBeInstanceOf(S3FileRepository);
    });
    it('use local repository', () => {
      const repository = fileRepositoryFactory(ItemType.LOCAL_FILE, { local: MOCK_LOCAL_CONFIG });
      expect(repository).toBeInstanceOf(LocalFileRepository);
    });
    it('throws for conflicting settings', () => {
      expect(() => {
        fileRepositoryFactory(ItemType.LOCAL_FILE, { s3: MOCK_S3_CONFIG });
      }).toThrow(MalformedFileConfigError);

      expect(() => {
        fileRepositoryFactory(ItemType.S3_FILE, { local: MOCK_LOCAL_CONFIG });
      }).toThrow(MalformedFileConfigError);
    });
  });

  describe('upload', () => {
    const uploadPayload = { file: {} as unknown as ReadStream, size: 10, filepath: 'filepath' };

    it('upload successfully', async () => {
      const uploadFileMock = jest.spyOn(s3Repository, 'uploadFile').mockImplementation(async () => {
        // do nothing
      });
      expect((await s3FileService.upload(member, uploadPayload)).file).toBeTruthy();
      expect(uploadFileMock).toHaveBeenCalled();
    });

    it('upload failure will delete file', async () => {
      const uploadFileMock = jest.spyOn(s3Repository, 'uploadFile').mockRejectedValue('error');
      const deleteFileMock = jest.spyOn(s3Repository, 'deleteFile').mockImplementation(async () => {
        // do nothing
      });
      await expect(s3FileService.upload(member, uploadPayload)).rejects.toMatchObject(
        new UploadFileUnexpectedError(expect.anything()),
      );
      expect(uploadFileMock).toHaveBeenCalled();
      expect(deleteFileMock).toHaveBeenCalled();
    });
  });

  describe('getFile', () => {
    const downloadPayload = { path: 'filepath', id: 'id' };

    it('get file successfully', async () => {
      const returnValue = 'readstream' as unknown as ReadStream;
      const downloadMock = jest
        .spyOn(s3Repository, 'getFile')
        .mockImplementation(async () => returnValue);
      expect(await s3FileService.getFile(member, downloadPayload)).toBeTruthy();
      expect(downloadMock).toHaveBeenCalled();
    });

    it('signed out member can get file', async () => {
      const returnValue = 'readstream' as unknown as ReadStream;
      const downloadMock = jest
        .spyOn(s3Repository, 'getFile')
        .mockImplementation(async () => returnValue);
      expect(await s3FileService.getFile(undefined, downloadPayload)).toBeTruthy();
      expect(downloadMock).toHaveBeenCalled();
    });
  });

  describe('getUrl', () => {
    const downloadPayload = { path: 'filepath', id: 'id' };

    it('get url successfully', async () => {
      const returnValue = 'url';
      const downloadMock = jest
        .spyOn(s3Repository, 'getUrl')
        .mockImplementation(async () => returnValue);
      expect(await s3FileService.getUrl(downloadPayload)).toBeTruthy();
      expect(downloadMock).toHaveBeenCalled();
    });

    it('signed out member can get url', async () => {
      const returnValue = 'url';
      const downloadMock = jest
        .spyOn(s3Repository, 'getUrl')
        .mockImplementation(async () => returnValue);
      expect(await s3FileService.getUrl(downloadPayload)).toBeTruthy();
      expect(downloadMock).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('delete successfully', async () => {
      const deleteMock = jest.spyOn(s3Repository, 'deleteFile').mockImplementation(async () => {
        // do nothing
      });
      await s3FileService.delete(member, 'filepath');
      expect(deleteMock).toHaveBeenCalled();
    });

    it('empty path throws', async () => {
      await expect(s3FileService.delete(member, '')).rejects.toMatchObject(
        new DeleteFileInvalidPathError(expect.anything()),
      );
    });
  });

  describe('deleteFolder', () => {
    it('delete successfully', async () => {
      const deleteMock = jest.spyOn(s3Repository, 'deleteFolder').mockImplementation(async () => {
        // do nothing
      });
      await s3FileService.deleteFolder(member, 'filepath');
      expect(deleteMock).toHaveBeenCalled();
    });

    it('empty path throws', async () => {
      await expect(s3FileService.deleteFolder(member, '')).rejects.toMatchObject(
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
      const copyMock = jest
        .spyOn(s3Repository, 'copyFile')
        .mockImplementation(async () => 'string');
      await s3FileService.copy(member, copyPayload);
      expect(copyMock).toHaveBeenCalled();
    });

    it('empty originalPath throws', async () => {
      await expect(
        s3FileService.copy(member, { ...copyPayload, originalPath: '' }),
      ).rejects.toMatchObject(new CopyFileInvalidPathError(expect.anything()));
    });

    it('empty newFilePath throws', async () => {
      await expect(
        s3FileService.copy(member, { ...copyPayload, newFilePath: '' }),
      ).rejects.toMatchObject(new CopyFileInvalidPathError(expect.anything()));
    });
  });

  describe('copyFolder', () => {
    const copyPayload = {
      newFolderPath: 'string',
      originalFolderPath: 'string',
    };

    it('copy folder successfully', async () => {
      const copyMock = jest
        .spyOn(s3Repository, 'copyFolder')
        .mockImplementation(async () => 'string');
      await s3FileService.copyFolder(member, copyPayload);
      expect(copyMock).toHaveBeenCalled();
    });

    it('empty originalFolderPath throws', async () => {
      await expect(
        s3FileService.copyFolder(member, { ...copyPayload, originalFolderPath: '' }),
      ).rejects.toMatchObject(new CopyFolderInvalidPathError(expect.anything()));
    });

    it('empty newFolderPath throws', async () => {
      await expect(
        s3FileService.copyFolder(member, { ...copyPayload, newFolderPath: '' }),
      ).rejects.toMatchObject(new CopyFolderInvalidPathError(expect.anything()));
    });
  });
});
