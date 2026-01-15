import { Redis } from 'ioredis';

import { REDIS_CONNECTION } from './config/redis';

export async function bustFileCache() {
  const redis = new Redis(REDIS_CONNECTION);

  console.debug('DEV: Busting Redis cache for file urls');
  const cache_keys = await redis.keys('file_service_url_caching*');
  console.debug(`DEV: Removing ${cache_keys.length} keys`);
  cache_keys.forEach((key) => {
    redis.expire(key, 0);
  });
  console.debug('DEV: Done busting cache');
}
