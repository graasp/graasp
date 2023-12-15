import { ItemType } from '@graasp/sdk';

import { S3FileConfiguration } from '../../../file/interfaces/configuration';
import FileService from '../../../file/service';
import { HtmlService } from './service';
import { HtmlValidator } from './validator';

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
const fileService = new FileService({ s3: {} as unknown as S3FileConfiguration }, ItemType.S3_FILE);

describe('Html Service', () => {
  const htmlService = new MockHtmlService(fileService, 'prefix', 'mimetype', 'ext', validator);

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
