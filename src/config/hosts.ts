import { getEnv } from './env';

getEnv();

export const ALIAS_SERVICE_ORIGIN = process.env.ALIAS_SERVICE_ORIGIN ?? 'https://go.graasp.org';
