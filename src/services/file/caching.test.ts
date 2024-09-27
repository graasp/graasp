import { faker } from '@faker-js/faker';

import { FastifyInstance } from 'fastify';

import build from '../../../test/app';
import { FILE_SERVICE_URLS_CACHING_DI_KEY } from '../../di/constants';
import { resolveDependency } from '../../di/utils';
import { ServiceCaching } from './caching';

describe('ServiceCaching Tests', () => {
  let app: FastifyInstance;
  let cache: ServiceCaching;
  const MOCKED_PATH = '1b304da5_b342_46e8_a484_1712d5209e43';
  const getRandomUrl = async () => faker.internet.url(); // returns a new URL at each run
  const getOrCache = (expirationInSeconds = 3600) =>
    cache.getOrCache(MOCKED_PATH, getRandomUrl, expirationInSeconds);

  const resetValidations = async () => {
    await cache.delete(MOCKED_PATH);
  };

  beforeEach(async () => {
    ({ app } = await build());
    cache = resolveDependency(FILE_SERVICE_URLS_CACHING_DI_KEY);
  });

  afterEach(async () => {
    await resetValidations();
    jest.clearAllMocks();
    app.close();
  });

  it('Empty cache returns given URL once, but then returns the cached URL', async () => {
    const url1 = await getOrCache();
    const url2 = await getOrCache();

    // Without the cache, URL1 and URL2 would be different,
    // so check the equality to validate the cache.
    expect(url2).toBe(url1);
  });

  it('Cache entry expires after the timeout', async () => {
    const EXPIRES_IN_SECONDS = 1;
    const EXPIRES_IN_MS = EXPIRES_IN_SECONDS * 1000;

    const url1 = await getOrCache(EXPIRES_IN_SECONDS);
    expect(await getOrCache(EXPIRES_IN_SECONDS)).toBe(url1);

    // Wait a bit more than the expiration time to avoid flacky test.
    await new Promise((resolve) => setTimeout(resolve, EXPIRES_IN_MS + 500));
    expect(await getOrCache()).not.toBe(url1);
  });

  it('Delete cache entry successfully', async () => {
    const url1 = await getOrCache();
    const url2 = await getOrCache();

    // Without the cache, URL1 and URL2 would be different,
    // so check the equality to validate the cache.
    expect(url2).toBe(url1);

    await cache.delete(MOCKED_PATH);
    expect(await getOrCache()).not.toBe(url1);
  });
});
