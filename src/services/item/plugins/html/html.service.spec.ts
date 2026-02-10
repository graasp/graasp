import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

import { BaseLogger } from '../../../../logger';
import { FileStorage } from '../../../file/types';
import { StorageService } from '../../../member/plugins/storage/memberStorage.service';
import { ItemRepository } from '../../item.repository';
import { HtmlService } from './html.service';
import type { HtmlValidator } from './validator';

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

const validator = new MockValidator();

const MOCK_S3_CONFIG = {
  s3Region: 'string',
  s3Bucket: 'string',
  s3AccessKeyId: 'string',
  s3SecretAccessKey: 'string',
};

describe('Html Service', () => {
  const htmlService = new MockHtmlService(
    {
      config: { s3: MOCK_S3_CONFIG },
      fileStorageType: FileStorage.S3,
    },
    new MockStorageService({} as ItemRepository),
    'prefix',
    'mimetype',
    'ext',
    validator,
    console as unknown as BaseLogger,
  );

  it('builds root path', () => {
    expect(htmlService.buildRootPath('prefix', 'mockId')).toEqual('prefix/mockId');
  });

  it('builds package path', () => {
    expect(htmlService.buildPackagePath('root', 'mock-file')).toEqual('root/mock-file.ext');
  });

  it('builds content path', () => {
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
});
