import { buildContentPath, buildH5PPath, buildRootPath, validatePluginOptions } from '../src/utils';
import { DEFAULT_PLUGIN_OPTIONS } from './fixtures';

describe('Utils', () => {
  describe('validatePluginOptions', () => {
    it('accepts correct plugin options', () => {
      const options = {
        ...DEFAULT_PLUGIN_OPTIONS,
        routes: {
          assets: '/mock-assets-route/',
          content: '/mock-content-route/',
        },
      };
      expect(() => validatePluginOptions(DEFAULT_PLUGIN_OPTIONS)).not.toThrowError();
      expect(() => validatePluginOptions(options)).not.toThrowError();
    });

    it('throws if path prefix is empty', () => {
      const options = {
        ...DEFAULT_PLUGIN_OPTIONS,
        pathPrefix: '',
      };
      expect(() => validatePluginOptions(options)).toThrow(
        'H5P path prefix environment variable is not defined!',
      );
    });

    it('throws if path prefix starts with /', () => {
      const options = {
        ...DEFAULT_PLUGIN_OPTIONS,
        pathPrefix: '/mock-prefix',
      };
      expect(() => validatePluginOptions(options)).toThrow(
        'H5P path prefix should not start with a "/"!',
      );
    });

    it('throws if routes do not start with /', () => {
      const options = {
        ...DEFAULT_PLUGIN_OPTIONS,
        routes: {
          assets: 'mock-assets-route/',
          content: 'mock-content-route/',
        },
      };
      expect(() => validatePluginOptions(options)).toThrow(
        "H5P routes must start and end with a forward slash ('/') !",
      );
    });

    it('throws if routes do not end with /', () => {
      const options = {
        ...DEFAULT_PLUGIN_OPTIONS,
        routes: {
          assets: '/mock-assets-route',
          content: '/mock-content-route',
        },
      };
      expect(() => validatePluginOptions(options)).toThrow(
        "H5P routes must start and end with a forward slash ('/') !",
      );
    });
  });

  it('builds root path', () => {
    expect(buildRootPath('prefix', 'mockId')).toEqual('prefix/mockId');
  });

  it('builds .h5p path', () => {
    expect(buildH5PPath('root', 'mock-file')).toEqual('root/mock-file.h5p');
  });

  it('builds content path', () => {
    expect(buildContentPath('root')).toEqual('root/content');
  });
});
