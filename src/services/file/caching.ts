import { hoursToSeconds } from 'date-fns';
import { Redis } from 'ioredis';
import { singleton } from 'tsyringe';

import { UrlServiceCaching } from './types';

const EXPIRES_IN_SECONDS = hoursToSeconds(1);
const REDIS_KEY = 'file_service_url_caching';
const buildRedisKey = (filePath: string) => `${REDIS_KEY}:${filePath}`;

@singleton()
export class FileServiceUrlCaching implements UrlServiceCaching {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async add(filePath: string, url: string, expiresInSeconds = EXPIRES_IN_SECONDS) {
    await this.redis.set(buildRedisKey(filePath), url);
    await this.redis.expire(buildRedisKey(filePath), expiresInSeconds);
  }

  async get(filePath: string) {
    return this.redis.get(buildRedisKey(filePath));
  }

  async getOrCache(
    filePath: string,
    newUrl: () => Promise<string>,
    expiresInSeconds = EXPIRES_IN_SECONDS,
  ) {
    const cachedUrl = await this.get(filePath);

    if (cachedUrl) {
      return cachedUrl;
    }

    const url = await newUrl();

    await this.add(filePath, url, expiresInSeconds);

    return url;
  }

  async delete(filePath: string) {
    await this.redis.del(buildRedisKey(filePath));
  }
}
