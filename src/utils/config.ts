import { config } from 'dotenv';
import os from 'os';

import {
  BUILDER_ITEMS_PREFIX,
  ClientHostManager,
  Context,
  GPTVersion,
  ItemType,
  LIBRARY_ITEMS_PREFIX,
  PLAYER_ITEMS_PREFIX,
} from '@graasp/sdk';

import {
  LocalFileConfiguration,
  S3FileConfiguration,
} from '../services/file/interfaces/configuration';
import { asDefined } from './assertions';
import { ExpectedEnvVariable } from './errors';

enum Environment {
  production = 'production',
  staging = 'staging',
  development = 'development',
  test = 'test',
}

export const LOG_LEVEL: string | undefined = process.env.LOG_LEVEL;
export const NODE_ENV: string | undefined = process.env.NODE_ENV;

export const ENVIRONMENT: Environment = (() => {
  switch (NODE_ENV) {
    case Environment.production:
      config({ path: '.env.production', override: true });
      return Environment.production;
    case Environment.staging:
      config({ path: '.env.staging', override: true });
      return Environment.staging;
    case Environment.test:
      config({ path: '.env.test', override: true });
      return Environment.test;
    default:
      config({ path: '.env.development', override: true });
      return Environment.development;
  }
})();

export const PROD = ENVIRONMENT === Environment.production;
export const STAGING = ENVIRONMENT === Environment.staging;
export const DEV = ENVIRONMENT === Environment.development;
export const TEST = ENVIRONMENT === Environment.test;

export const APP_VERSION = process.env.APP_VERSION;

const DEFAULT_HOST = 'http://localhost:3000';

export const BUILDER_HOST = {
  name: Context.Builder,
  url: new URL(process.env.BUILDER_CLIENT_HOST ?? DEFAULT_HOST),
};

export const PLAYER_HOST = {
  name: Context.Player,
  url: new URL(process.env.PLAYER_CLIENT_HOST ?? DEFAULT_HOST),
};

export const LIBRARY_HOST = {
  name: Context.Library,
  url: new URL(process.env.LIBRARY_CLIENT_HOST ?? DEFAULT_HOST),
};

export const ACCOUNT_HOST = {
  name: Context.Account,
  url: new URL(process.env.ACCOUNT_CLIENT_HOST ?? DEFAULT_HOST),
};

export const ANALYTICS_HOST = {
  name: Context.Analytics,
  url: new URL(process.env.ANALYTICS_CLIENT_HOST ?? DEFAULT_HOST),
};

export const CLIENT_HOSTS = [BUILDER_HOST, PLAYER_HOST, LIBRARY_HOST, ACCOUNT_HOST, ANALYTICS_HOST];

// Add the hosts of the different clients
ClientHostManager.getInstance()
  .addPrefix(Context.Builder, BUILDER_ITEMS_PREFIX)
  .addPrefix(Context.Library, LIBRARY_ITEMS_PREFIX)
  .addPrefix(Context.Player, PLAYER_ITEMS_PREFIX)
  .addHost(Context.Builder, BUILDER_HOST.url)
  .addHost(Context.Library, LIBRARY_HOST.url)
  .addHost(Context.Player, PLAYER_HOST.url);

export const PROTOCOL = process.env.PROTOCOL || 'http';
export const HOSTNAME = process.env.HOSTNAME || 'localhost';

export const PORT = process.env.PORT ? +process.env.PORT : 3000;
export const HOST = `${PROTOCOL}://${HOSTNAME}:${PORT}`;

if (!process.env.COOKIE_DOMAIN) {
  throw new Error('COOKIE_DOMAIN is undefined');
}

export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
export const CORS_ORIGIN_REGEX = process.env.CORS_ORIGIN_REGEX;

if (!process.env.AUTH_CLIENT_HOST) {
  throw new Error('Auth client host env var is not defined!');
}
export const AUTH_CLIENT_HOST = new URL(
  // legacy fallback if the env var does not have the protocol prefix
  process.env.AUTH_CLIENT_HOST.match(/^https?:\/\/.*/)
    ? process.env.AUTH_CLIENT_HOST
    : `${PROTOCOL}://${process.env.AUTH_CLIENT_HOST}`,
);

/*
 * Warning for PUBLIC_URL:
 * make sure that process.env.PUBLIC_URL / HOST have the format ${PROTOCOL}://${HOSTNAME}:${PORT}
 * See the following example where the format is only ${HOSTNAME}:${PORT} in which case
 * it interprets the hostname as protocol and the port as the pathname. Using the complete URL
 * scheme fixes that
 *
 * $ node
 * Welcome to Node.js v16.20.1.
 * Type ".help" for more information.
 * > new URL('localhost:3000')
 * URL {
 *   href: 'localhost:3000',
 *   origin: 'null',
 *   protocol: 'localhost:',
 *   username: '',
 *   password: '',
 *   host: '',
 *   hostname: '',
 *   port: '',
 *   pathname: '3000',
 *   search: '',
 *   searchParams: URLSearchParams {},
 *   hash: ''
 * }
 * >
 */
export const PUBLIC_URL = new URL(process.env.PUBLIC_URL ?? HOST);

export const MOBILE_AUTH_URL = new URL(process.env.MOBILE_AUTH_URL || 'https://mobile.graasp.org');

export const MOBILE_DEEP_LINK_PROTOCOL = new URL(
  // the domain part below is just an example to check the validity of the URL
  `${process.env.MOBILE_DEEP_LINK_PROTOCOL || 'graasp-mobile'}://graasp.org`,
).protocol; // we only use the protocol anyway

export const DATABASE_LOGS = process.env.DATABASE_LOGS === 'true';

// Graasp constants
/**
 * Session cookie key
 */
if (!process.env.SECURE_SESSION_SECRET_KEY) {
  throw new Error('SECURE_SESSION_SECRET_KEY is not defined');
}
export const SECURE_SESSION_SECRET_KEY: string = process.env.SECURE_SESSION_SECRET_KEY!;
export const SECURE_SESSION_EXPIRATION_IN_SECONDS: number =
  +process.env.SECURE_SESSION_EXPIRATION_IN_SECONDS! || 604800; // 7days
export const MAX_SECURE_SESSION_EXPIRATION_IN_SECONDS: number =
  +process.env.MAX_SECURE_SESSION_EXPIRATION_IN_SECONDS! || 15552000; // 6 * 30days
/**
 * JWT
 */
if (!process.env.JWT_SECRET) {
  throw new Error('process.env.JWT_SECRET should be defined');
}
export const JWT_SECRET = process.env.JWT_SECRET;
/** Register token expiration, in minutes */
export const REGISTER_TOKEN_EXPIRATION_IN_MINUTES = 60;
/** Login token expiration, in minutes */
export const LOGIN_TOKEN_EXPIRATION_IN_MINUTES = 30;

// Token based auth
export const TOKEN_BASED_AUTH = process.env.TOKEN_BASED_AUTH === 'true';
if (!process.env.AUTH_TOKEN_JWT_SECRET) {
  throw new Error('process.env.AUTH_TOKEN_JWT_SECRET should be defined');
}
export const AUTH_TOKEN_JWT_SECRET = process.env.AUTH_TOKEN_JWT_SECRET;
if (!process.env.REFRESH_TOKEN_JWT_SECRET) {
  throw new Error('process.env.REFRESH_TOKEN_JWT_SECRET should be defined');
}
export const REFRESH_TOKEN_JWT_SECRET = process.env.REFRESH_TOKEN_JWT_SECRET;
/** Auth token expiration, in minutes */
export const AUTH_TOKEN_EXPIRATION_IN_MINUTES = process.env.AUTH_TOKEN_EXPIRATION_IN_MINUTES
  ? +process.env.AUTH_TOKEN_EXPIRATION_IN_MINUTES
  : 10080;
/** Refresh token expiration, in minutes */
export const REFRESH_TOKEN_EXPIRATION_IN_MINUTES = process.env.REFRESH_TOKEN_EXPIRATION_IN_MINUTES
  ? +process.env.REFRESH_TOKEN_EXPIRATION_IN_MINUTES
  : 86400;

/** Password reset token Secret */
export const PASSWORD_RESET_JWT_SECRET: string = process.env.PASSWORD_RESET_JWT_SECRET!;
if (!PASSWORD_RESET_JWT_SECRET) {
  throw new Error('PASSWORD_RESET_JWT_SECRET should be defined');
}
/** Password reset token expiration, in minutes */
export const PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES: number =
  Number(process.env.PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES) || 1440;

/** Email change token Secret */
export const EMAIL_CHANGE_JWT_SECRET: string = asDefined(
  process.env.EMAIL_CHANGE_JWT_SECRET,
  ExpectedEnvVariable,
  'EMAIL_CHANGE_JWT_SECRET',
);

/** Email change token expiration, in minutes */
export const EMAIL_CHANGE_JWT_EXPIRATION_IN_MINUTES: number =
  Number(process.env.EMAIL_CHANGE_JWT_EXPIRATION_IN_MINUTES) || 1440;

// Graasp mailer config
if (
  !process.env.MAILER_CONFIG_SMTP_HOST ||
  !process.env.MAILER_CONFIG_USERNAME ||
  !process.env.MAILER_CONFIG_PASSWORD
) {
  throw new Error(
    `Email config is not fully defined: ${JSON.stringify({
      host: process.env.MAILER_CONFIG_SMTP_HOST,
      username: process.env.MAILER_CONFIG_USERNAME,
      password: process.env.MAILER_CONFIG_PASSWORD,
    })}`,
  );
}
export const MAILER_CONFIG_SMTP_HOST = process.env.MAILER_CONFIG_SMTP_HOST;
export const MAILER_CONFIG_SMTP_PORT = parseInt(process.env.MAILER_CONFIG_SMTP_PORT ?? '465');
export const MAILER_CONFIG_SMTP_USE_SSL = process.env.MAILER_CONFIG_SMTP_USE_SSL !== 'false';
export const MAILER_CONFIG_USERNAME = process.env.MAILER_CONFIG_USERNAME;
export const MAILER_CONFIG_PASSWORD = process.env.MAILER_CONFIG_PASSWORD;
export const MAILER_CONFIG_FROM_EMAIL =
  process.env.MAILER_CONFIG_FROM_EMAIL || 'no-reply@graasp.org';

// Graasp file item
// TODO: should this be here?
export const FILE_STORAGE_ROOT_PATH = process.env.FILE_STORAGE_ROOT_PATH || process.env.TMPDIR;
export const FILE_STORAGE_HOST = process.env.FILE_STORAGE_HOST;

// Graasp S3 file item
// TODO: should this be here?
export const S3_FILE_ITEM_PLUGIN = process.env.S3_FILE_ITEM_PLUGIN === 'true';
export const S3_FILE_ITEM_REGION = process.env.S3_FILE_ITEM_REGION;
export const S3_FILE_ITEM_BUCKET = process.env.S3_FILE_ITEM_BUCKET;
export const S3_FILE_ITEM_ACCESS_KEY_ID = process.env.S3_FILE_ITEM_ACCESS_KEY_ID;
export const S3_FILE_ITEM_SECRET_ACCESS_KEY = process.env.S3_FILE_ITEM_SECRET_ACCESS_KEY;
export const S3_FILE_ITEM_HOST = process.env.S3_FILE_ITEM_HOST;

const getS3FilePluginConfig = () => {
  if (!S3_FILE_ITEM_REGION) {
    throw new Error('Missing s3 "region" config for file plugin');
  }
  if (!S3_FILE_ITEM_BUCKET) {
    throw new Error('Missing s3 "bucket" config for file plugin');
  }
  if (!S3_FILE_ITEM_ACCESS_KEY_ID) {
    throw new Error('Missing s3 "access key" config for file plugin');
  }
  if (!S3_FILE_ITEM_SECRET_ACCESS_KEY) {
    throw new Error('Missing s3 "secret access key" config for file plugin');
  }
  return {
    s3Region: S3_FILE_ITEM_REGION,
    s3Bucket: S3_FILE_ITEM_BUCKET,
    s3AccessKeyId: S3_FILE_ITEM_ACCESS_KEY_ID,
    s3SecretAccessKey: S3_FILE_ITEM_SECRET_ACCESS_KEY,
  };
};
// the varaible is undefined when `S3_FILE_ITEM_PLUGIN` is false
export const S3_FILE_ITEM_PLUGIN_OPTIONS: S3FileConfiguration | undefined = S3_FILE_ITEM_PLUGIN
  ? getS3FilePluginConfig()
  : undefined;

export const FILE_ITEM_TYPE = S3_FILE_ITEM_PLUGIN ? ItemType.S3_FILE : ItemType.LOCAL_FILE;

if (!process.env.EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN) {
  throw new Error('EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN is not defined');
}
export const EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN =
  process.env.EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN;

// Graasp apps
if (!process.env.APPS_JWT_SECRET) {
  throw new Error('APPS_JWT_SECRET is not defined');
}
export const APPS_JWT_SECRET = process.env.APPS_JWT_SECRET;

// Graasp websockets
export const REDIS_HOST = process.env.REDIS_HOST;
export const REDIS_PORT: number = +process.env.REDIS_PORT! || 6379;
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
export const REDIS_USERNAME = process.env.REDIS_USERNAME;

// validation
export const IMAGE_CLASSIFIER_API = process.env.IMAGE_CLASSIFIER_API ?? '';

export const FILE_ITEM_PLUGIN_OPTIONS: LocalFileConfiguration = {
  storageRootPath: FILE_STORAGE_ROOT_PATH ?? 'root',
  localFilesHost: FILE_STORAGE_HOST,
};

export const ITEMS_ROUTE_PREFIX = '/items';
export const APP_ITEMS_PREFIX = '/app-items';
export const THUMBNAILS_ROUTE_PREFIX = '/thumbnails';

export const MEMBER_PROFILE_ROUTE_PREFIX = '/profile';
export const MEMBER_EXPORT_DATA_ROUTE_PREFIX = '/export-data';

if (!process.env.APPS_PUBLISHER_ID) {
  throw new Error('APPS_PUBLISHER_ID is not defined');
}
export const APPS_PUBLISHER_ID = process.env.APPS_PUBLISHER_ID;

// used for hashing password
export const SALT_ROUNDS = 10;

export const TMP_FOLDER = os.tmpdir();

if (!process.env.RECAPTCHA_SECRET_ACCESS_KEY) {
  console.error('RECAPTCHA_SECRET_ACCESS_KEY environment variable missing.');
  process.exit(1);
}
export const RECAPTCHA_SECRET_ACCESS_KEY = process.env.RECAPTCHA_SECRET_ACCESS_KEY;
export const RECAPTCHA_VERIFY_LINK = 'https://www.google.com/recaptcha/api/siteverify';
export const RECAPTCHA_SCORE_THRESHOLD = 0.5;

// todo: use env var?
export const GET_MOST_LIKED_ITEMS_MAXIMUM = 50;
export const GET_MOST_RECENT_ITEMS_MAXIMUM = 50;

// Job scheduling
export const JOB_SCHEDULING: boolean = process.env.JOB_SCHEDULING === 'true';

// OpenAI
const getGptVersion = (): GPTVersion => {
  const GPTVersionEnv = process.env.OPENAI_GPT_VERSION ?? '';
  if ((Object.values(GPTVersion) as string[]).includes(GPTVersionEnv)) {
    return GPTVersionEnv as GPTVersion;
  }
  return GPTVersion.GPT_3_5_TURBO;
};
export const OPENAI_GPT_VERSION = getGptVersion();
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const OPENAI_ORG_ID = process.env.OPENAI_ORG_ID;

export const OPENAI_MAX_TEMPERATURE = 2;
export const OPENAI_MIN_TEMPERATURE = 0;
export const OPENAI_DEFAULT_TEMPERATURE = 1;

/**
 * mapping from language code and postgres full text search supported language
 */
export const ALLOWED_SEARCH_LANGS = {
  de: 'german',
  en: 'english',
  es: 'spanish',
  fr: 'french',
  it: 'italian',
};

// Geolocation API Key
export const GEOLOCATION_API_KEY = process.env.GEOLOCATION_API_KEY ?? '';
export const GEOLOCATION_API_HOST = process.env.GEOLOCATION_API_HOST;

////////////
// Sentry //
////////////
export const SENTRY_ENV: string | undefined = process.env.SENTRY_ENV;
export const SENTRY_DSN: string | undefined = process.env.SENTRY_DSN;
export const SENTRY_ENABLE_PERFORMANCE: boolean =
  (process.env.SENTRY_ENABLE_PERFORMANCE ?? 'true') === 'true'; // env var must be literal string "true"
export const SENTRY_ENABLE_PROFILING: boolean =
  (process.env.SENTRY_ENABLE_PROFILING ?? 'true') === 'true'; // env var must be literal string "true"
export const SENTRY_PROFILES_SAMPLE_RATE: number = +process.env.SENTRY_PROFILES_SAMPLE_RATE! || 1.0;
export const SENTRY_TRACES_SAMPLE_RATE: number = +process.env.SENTRY_TRACES_SAMPLE_RATE! || 1.0;

/////////////////
// CI and Test //
/////////////////
export const JEST_WORKER_ID: number = +process.env.JEST_WORKER_ID! || 1;
export const CI: boolean = process.env.CI === 'true';
export const AUTO_RUN_MIGRATIONS: boolean = (process.env.AUTO_RUN_MIGRATIONS ?? 'true') === 'true';

//////////////////////////////////////
// Database Environements Variables //
//////////////////////////////////////
export const DEFAULT_DB_PORT = 5432;
// Can be undefined, so tests can run without setting it. In production, TypeORM will throw an exception if not defined.
export const DB_HOST: string | undefined = process.env.DB_HOST;
export const DB_PORT = +process.env.DB_PORT! || DEFAULT_DB_PORT;
export const DB_USERNAME: string | undefined = process.env.DB_USERNAME;
export const DB_PASSWORD: string | undefined = process.env.DB_PASSWORD;
export const DB_NAME: string | undefined = process.env.DB_NAME;
export const DB_CONNECTION_POOL_SIZE: number = +process.env.DB_CONNECTION_POOL_SIZE! || 10;
export const DB_READ_REPLICA_HOSTS: string[] = process.env.DB_READ_REPLICA_HOSTS
  ? process.env.DB_READ_REPLICA_HOSTS?.split(',')
  : [];

export const MASTER_DB_PORT = CI ? DEFAULT_DB_PORT + JEST_WORKER_ID - 1 : DB_PORT;
