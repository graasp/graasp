import { hoursToSeconds } from 'date-fns';
import { Redis } from 'ioredis';

import { ICachingService } from './interfaces';

const EXPIRES_IN_SECONDS = hoursToSeconds(1);

export class CachingService implements ICachingService {
  private readonly redis: Redis;
  private readonly contextKey: string;

  constructor(redis: Redis, contextKey: string) {
    this.redis = redis;
    this.contextKey = contextKey;
  }

  private buildRedisKey(key: string) {
    return `${this.contextKey}:${key}`;
  }

  async add(key: string, value: string, expiresInSeconds = EXPIRES_IN_SECONDS) {
    await this.redis.set(this.buildRedisKey(key), value);
    await this.redis.expire(this.buildRedisKey(key), expiresInSeconds);
  }

  async get(key: string) {
    return this.redis.get(this.buildRedisKey(key));
  }

  async getOrCache(
    key: string,
    newValue: () => Promise<string>,
    expiresInSeconds = EXPIRES_IN_SECONDS,
  ) {
    const cachedvalue = await this.get(key);

    if (cachedvalue) {
      return cachedvalue;
    }

    const value = await newValue();

    await this.add(key, value, expiresInSeconds);

    return value;
  }

  async delete(key: string) {
    await this.redis.del(this.buildRedisKey(key));
  }
}
