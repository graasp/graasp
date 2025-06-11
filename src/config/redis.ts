import { getEnv } from './env';
import { requiredEnvVar } from './helpers';

getEnv();

export const REDIS_CONNECTION = requiredEnvVar('REDIS_CONNECTION');
