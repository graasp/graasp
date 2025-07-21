import { getEnv } from './env';
import { requiredEnvVar, toBoolean } from './helpers';

getEnv();

export const MAILER_CONNECTION = requiredEnvVar('MAILER_CONNECTION');
export const MAILER_USE_SSL = toBoolean(process.env.MAILER_USE_SSL, { default: true });
export const MAILER_CONFIG_FROM_EMAIL =
  process.env.MAILER_CONFIG_FROM_EMAIL ?? 'no-reply@graasp.org';
