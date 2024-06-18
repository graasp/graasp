import { FastifyBaseLogger } from 'fastify';

import { ItemType } from '@graasp/sdk';

import { S3FileConfiguration } from '../../../file/interfaces/configuration.js';
import FileService from '../../../file/service.js';
import { HtmlService } from './service.js';
import { HtmlValidator } from './validator.js';

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

const validator = new MockValidator();

// todo: improve typing when adding more tests
const fileService = new FileService(
  { s3: {} as unknown as S3FileConfiguration },
  ItemType.S3_FILE,
  console as unknown as FastifyBaseLogger,
);

describe('Html Service', () => {
  const htmlService = new MockHtmlService(
    fileService,
    'prefix',
    'mimetype',
    'ext',
    validator,
    console as unknown as FastifyBaseLogger,
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
