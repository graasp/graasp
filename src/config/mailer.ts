import { getEnv } from './env';
import { requiredEnvVar } from './helpers';

getEnv();

export const MAILER_CONNECTION = requiredEnvVar('MAILER_CONNECTION');
export const MAILER_CONFIG_FROM_EMAIL =
  process.env.MAILER_CONFIG_FROM_EMAIL ?? 'no-reply@graasp.org';
