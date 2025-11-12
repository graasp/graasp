import { describe, expect, it } from 'vitest';

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
});
