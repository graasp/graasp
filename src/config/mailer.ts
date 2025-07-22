import { DEV, getEnv } from './env';
import { requiredEnvVar, toBoolean } from './helpers';

getEnv();

export const MAILER_CONNECTION = requiredEnvVar('MAILER_CONNECTION');
/**
 * In Development we disable Mailer SSL
 * In production we enable it by default, it can be disbaled by setting the MAILER_USE_SSL=false
 */
export const MAILER_USE_SSL = DEV
  ? false
  : toBoolean(process.env.MAILER_USE_SSL, { default: true });
export const MAILER_CONFIG_FROM_EMAIL =
  process.env.MAILER_CONFIG_FROM_EMAIL ?? 'no-reply@graasp.org';
