import { type ConnectionOptions } from 'bullmq';

import { REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_USERNAME } from '../utils/config';

export const REDIS_CONNECTION: ConnectionOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  username: REDIS_USERNAME,
  password: REDIS_PASSWORD,
};

export const QueueNames = { ItemExport: 'item-export' };
