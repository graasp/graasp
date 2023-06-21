import 'jest-ts-auto-mock';

import { EtherpadPluginOptions } from '../src/types';

export const TEST_ENV: EtherpadPluginOptions = {
  url: 'http://localhost:9001',
  apiKey: Array.from({ length: 64 }, () => 'a').join(''), // format is /^[a-f\d]{64}$/
};
