import { ETHERPAD_API_KEY, ETHERPAD_URL } from '../../../../../utils/config';
import { EtherpadPluginOptions } from '../types';
import { validatePluginOptions } from '../utils';

describe('Utils', () => {
  describe('validate plugin options', () => {
    const correctOptions = { url: ETHERPAD_URL, apiKey: ETHERPAD_API_KEY };
    it('accepts correct options', () => {
      expect(() => validatePluginOptions(correctOptions)).not.toThrow();
    });

    it('throws if url is not defined', () => {
      const undefinedUrl = {
        ...correctOptions,
        url: undefined, // on purpose: this may happen if core does not use strict nullables
      } as unknown as EtherpadPluginOptions;
      expect(() => validatePluginOptions(undefinedUrl)).toThrowError(
        'Etherpad url environment variable is not defined!',
      );
    });

    it('throws if url does not start with protocol', () => {
      expect(() => validatePluginOptions({ ...correctOptions, url: 'localhost' })).toThrowError(
        'Etherpad url environment variable must contain protocol!',
      );
    });

    it('throws if api key is not defined', () => {
      const undefinedApiKey = {
        ...correctOptions,
        apiKey: undefined, // on purpose: this may happen if core does not use strict nullables
      } as unknown as EtherpadPluginOptions;
      expect(() => validatePluginOptions(undefinedApiKey)).toThrowError(
        'Etherpad API key environment variable is not defined!',
      );
    });

    it('throws if api key format is invalid', () => {
      expect(() => validatePluginOptions({ ...correctOptions, apiKey: 'invalidKey' })).toThrowError(
        'Etherpad API key environment variable format must be /^[a-fd]{64}$/',
      );
    });
  });
});
