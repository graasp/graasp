import fs from 'fs';
import fsp from 'fs/promises';
import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MemberFactory } from '../../../../../test/factories/member.factory';
import { BaseLogger } from '../../../../logger';
import { TMP_FOLDER } from '../../../../utils/config';
import { FileStorage } from '../../../file/types';
import { StorageService } from '../../../member/plugins/storage/memberStorage.service';
import { ItemRepository } from '../../item.repository';
import { HtmlService } from './html.service';
import type { HtmlValidator } from './validator';

// ensure uuid.v4 is deterministic
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'uuid123'),
}));

// we mock extract-zip to prevent actual decompression of dummy data
vi.mock('extract-zip', () => {
  const fn = vi.fn(async () => {});
  return {
    __esModule: true,
    default: fn,
  };
});

class MockValidator implements HtmlValidator {
  isExtensionAllowed() {
    return true;
  }

  /**
   * Validates an extracted html package content
   */
  async validatePackage() {
    // do nothing
  }
}

class MockHtmlService extends HtmlService {}
class MockStorageService extends StorageService {}

const MOCK_PATH_PREFIX = 'test-prefix';
const USED_TMP_FOLDER = path.join(TMP_FOLDER, 'html-packages', MOCK_PATH_PREFIX);

const MOCK_S3_CONFIG = {
  s3Region: 'string',
  s3Bucket: 'string',
  s3AccessKeyId: 'string',
  s3SecretAccessKey: 'string',
};

const MOCK_ACTOR = MemberFactory();
const MOCK_DB = {} as any;

const createService = (
  storageService: MockStorageService = new MockStorageService({} as ItemRepository),
  validator: MockValidator = new MockValidator(),
) => {
  return new MockHtmlService(
    {
      config: { s3: MOCK_S3_CONFIG },
      fileStorageType: FileStorage.S3,
    },
    storageService,
    MOCK_PATH_PREFIX,
    'mimetype',
    'ext',
    validator,
    console as unknown as BaseLogger,
  );
};

describe('Html Service', () => {
  it('builds root path', () => {
    const htmlService = createService();
    expect(htmlService.buildRootPath('prefix', 'mockId')).toEqual('prefix/mockId');
  });

  it('builds package path', () => {
    const htmlService = createService();
    expect(htmlService.buildPackagePath('root', 'mock-file')).toEqual('root/mock-file.ext');
  });

  it('builds content path', () => {
    const htmlService = createService();
    expect(htmlService.buildContentPath('root')).toEqual('root/content');
  });

  it('uploadPackage should ignore disallowed extensions and upload allowed ones', async () => {
    // prepare temp directory with one allowed and one disallowed file
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'html-upload-test-'));
    try {
      const allowed = path.join(tmpDir, 'index.html');
      const ignored = path.join(tmpDir, 'notes.txt');
      fs.writeFileSync(allowed, '<html></html>');
      fs.writeFileSync(ignored, 'some notes');

      // build a minimal HtmlService
      const instance = new MockHtmlService(
        {
          config: { s3: MOCK_S3_CONFIG },
          fileStorageType: FileStorage.S3,
        },
        new MockStorageService({} as ItemRepository),
        'prefix',
        'mimetype',
        'ext',
        {
          // validator: only allow .html
          isExtensionAllowed: (ext: string) => ext === '.html',
          validatePackage: async () => {},
        },
        console as unknown as BaseLogger,
      );

      const member = { id: 'm' } as any;
      const uploadSpy = vi.spyOn(instance.fileService, 'upload').mockResolvedValue({} as any);

      await instance.uploadPackage(
        member,
        tmpDir,
        '/remote-root',
        console as unknown as BaseLogger,
      );

      // only html file should be uploaded
      expect(uploadSpy).toHaveBeenCalledTimes(1);
      expect(uploadSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          filepath: '/remote-root/index.html',
          mimetype: 'text/html',
        }),
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe('uploadFile', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('uploads package and returns metadata', async () => {
      const mockStorageService = new MockStorageService({} as ItemRepository);
      const storageSpy = vi
        .spyOn(mockStorageService, 'checkRemainingStorage')
        .mockResolvedValue(undefined);
      const mockValidator = new MockValidator();
      const validateSpy = vi.spyOn(mockValidator, 'validatePackage').mockResolvedValue(undefined);
      const htmlService = createService(mockStorageService, mockValidator);

      const uploadPackageSpy = vi
        .spyOn(htmlService, 'uploadPackage')
        .mockResolvedValue([expect.anything()]);

      const stream = Readable.from('data');
      const res = await htmlService.uploadFile(MOCK_DB, MOCK_ACTOR, 'file.ext', stream);

      expect(storageSpy).toHaveBeenCalled();
      expect(validateSpy).toHaveBeenCalled();
      expect(uploadPackageSpy).toHaveBeenCalled();
      expect(res).toEqual({
        remoteRootPath: `${MOCK_PATH_PREFIX}/uuid123`,
        baseName: 'file',
        contentId: 'uuid123',
      });

      // tmp should be empty
      const contents = await fsp.readdir(USED_TMP_FOLDER);
      expect(contents.length).toEqual(0);
    });

    it('wraps upload errors and still attempts to delete remote folder', async () => {
      const mockStorageService = new MockStorageService({} as ItemRepository);
      vi.spyOn(mockStorageService, 'checkRemainingStorage').mockResolvedValue(undefined);
      const htmlService = createService(mockStorageService);

      const uploadPackageSpy = vi.spyOn(htmlService, 'uploadPackage').mockResolvedValue(['mock']);

      uploadPackageSpy.mockRejectedValueOnce(new Error('fail'));
      const deleteSpy = vi
        .spyOn(htmlService.fileService, 'deleteFolder')
        .mockResolvedValue(undefined);

      await expect(
        htmlService.uploadFile(MOCK_DB, MOCK_ACTOR, 'file.ext', Readable.from('x')),
      ).rejects.toThrow('Unexpected server error while importing Html');

      expect(deleteSpy).toHaveBeenCalledWith(`${MOCK_PATH_PREFIX}/uuid123`);

      // tmp should be empty
      const contents = await fsp.readdir(USED_TMP_FOLDER);
      expect(contents.length).toEqual(0);
    });
  });
});
