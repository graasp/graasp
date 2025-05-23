import { config } from 'dotenv';
import os from 'os';

import { ClientManager, Context, GPTVersion } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import {
  LocalFileConfiguration,
  S3FileConfiguration,
} from '../services/file/interfaces/configuration';
import { FileStorage, FileStorageType } from '../services/file/types';
import { API_KEY_FORMAT } from '../services/item/plugins/etherpad/serviceConfig';
import { asDefined } from './assertions';
import { ExpectedEnvVariable } from './errors';
import { validateEnv } from './validators/utils';
import { RegexValidator, UrlValidator } from './validators/validators';

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
export const BUILD_TIMESTAMP = process.env.BUILD_TIMESTAMP;

export const CLIENT_HOST = process.env.CLIENT_HOST ?? 'http://localhost:3114';

export const LIBRARY_HOST = process.env.LIBRARY_CLIENT_HOST ?? CLIENT_HOST;

export const ALLOWED_ORIGINS = [new URL(CLIENT_HOST).origin, new URL(LIBRARY_HOST).origin];

// Add the hosts of the different clients
ClientManager.getInstance().setHost(CLIENT_HOST).addHost(Context.Library, LIBRARY_HOST);

export const PROTOCOL = process.env.PROTOCOL || 'http';
export const HOSTNAME = process.env.HOSTNAME || 'localhost';
/**
 * Host address the server listen on, default to 0.0.0.0 to bind to all addresses.
 */
export const HOST_LISTEN_ADDRESS = process.env.HOST_LISTEN_ADDRESS || '0.0.0.0';

export const PORT = process.env.PORT ? +process.env.PORT : 3000;
export const HOST = `${PROTOCOL}://${HOSTNAME}:${PORT}`;

if (!process.env.COOKIE_DOMAIN) {
  throw new Error('COOKIE_DOMAIN is undefined');
}

export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
export const CORS_ORIGIN_REGEX = process.env.CORS_ORIGIN_REGEX;

/**
 * Public url is the url where the server is hosted. Mostly used to set the cookie on the right domain
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
  process.env.MAILER_CONFIG_FROM_EMAIL ?? 'no-reply@graasp.org';

/**
 * GRAASP FILE STORAGE CONFIG
 */
export const FILE_STORAGE_ROOT_PATH = process.env.FILE_STORAGE_ROOT_PATH || process.env.TMPDIR;
export const FILE_STORAGE_HOST = process.env.FILE_STORAGE_HOST;

if (
  process.env.FILE_STORAGE_TYPE &&
  !(Object.values(FileStorage) as string[]).includes(process.env.FILE_STORAGE_TYPE)
) {
  throw new Error(
    `File Storage type is not handled: '${process.env.FILE_STORAGE_TYPE}'. It should be one of: ${Object.values(FileStorage)}`,
  );
}
export const FILE_STORAGE_TYPE =
  (process.env.FILE_STORAGE_TYPE as FileStorageType) ?? FileStorage.Local;

// Graasp S3 file item
// TODO: should this be here?
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
// the varaible is undefined when `FILE_STORAGE_TYPE` is local
export const S3_FILE_ITEM_PLUGIN_OPTIONS: S3FileConfiguration | undefined =
  FILE_STORAGE_TYPE === FileStorage.S3 ? getS3FilePluginConfig() : undefined;

export const FILE_ITEM_PLUGIN_OPTIONS: LocalFileConfiguration = {
  storageRootPath: FILE_STORAGE_ROOT_PATH ?? 'root',
  localFilesHost: FILE_STORAGE_HOST,
};

if (!process.env.H5P_PATH_PREFIX) {
  throw new Error('Invalid H5P path prefix');
}
export const H5P_PATH_PREFIX = process.env.H5P_PATH_PREFIX;

// ugly runtime type checking since typescript cannot infer types
// todo: please use a typed env checker library, this is awful
if (
  process.env.H5P_FILE_STORAGE_TYPE !== FileStorage.S3 &&
  process.env.H5P_FILE_STORAGE_TYPE !== FileStorage.Local
) {
  throw new Error('Invalid H5P file storage type provided');
}
export const H5P_FILE_STORAGE_TYPE = process.env.H5P_FILE_STORAGE_TYPE as FileStorageType;

// ugly runtime type checking since typescript cannot infer types
if (H5P_FILE_STORAGE_TYPE === FileStorage.S3) {
  if (
    !process.env.H5P_CONTENT_REGION ||
    !process.env.H5P_CONTENT_BUCKET ||
    !process.env.H5P_CONTENT_SECRET_ACCESS_KEY_ID ||
    !process.env.H5P_CONTENT_ACCESS_KEY_ID
  )
    throw new Error('H5P S3 configuration missing');
}
export const H5P_S3_CONFIG = {
  s3: {
    s3Region: process.env.H5P_CONTENT_REGION,
    s3Bucket: process.env.H5P_CONTENT_BUCKET,
    s3SecretAccessKey: process.env.H5P_CONTENT_SECRET_ACCESS_KEY_ID,
    s3AccessKeyId: process.env.H5P_CONTENT_ACCESS_KEY_ID,
  } as S3FileConfiguration,
};

// ugly runtime type checking since typescript cannot infer types
if (H5P_FILE_STORAGE_TYPE === FileStorage.Local) {
  if (!process.env.H5P_STORAGE_ROOT_PATH) throw new Error('H5P local storage root path missing');
}
export const H5P_LOCAL_CONFIG = {
  local: {
    storageRootPath: process.env.H5P_STORAGE_ROOT_PATH,
    localFilesHost: process.env.H5P_FILE_STORAGE_HOST,
  } as LocalFileConfiguration,
};

// ugly runtime type checking since typescript cannot infer types
export const H5P_FILE_STORAGE_CONFIG =
  H5P_FILE_STORAGE_TYPE === FileStorage.S3 ? H5P_S3_CONFIG : H5P_LOCAL_CONFIG;

export const ETHERPAD_URL = validateEnv('ETHERPAD_URL', new UrlValidator());

export const ETHERPAD_PUBLIC_URL = process.env.ETHERPAD_PUBLIC_URL;
export const ETHERPAD_API_KEY = validateEnv('ETHERPAD_API_KEY', new RegexValidator(API_KEY_FORMAT));
export const ETHERPAD_COOKIE_DOMAIN = process.env.ETHERPAD_COOKIE_DOMAIN;

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

// Graasp Search

export const MEILISEARCH_URL = process.env.MEILISEARCH_URL || '';
export const MEILISEARCH_MASTER_KEY = process.env.MEILISEARCH_MASTER_KEY;
export const MEILISEARCH_REBUILD_SECRET = process.env.MEILISEARCH_REBUILD_SECRET;
export const MEILISEARCH_STORE_LEGACY_PDF_CONTENT: boolean =
  process.env.MEILISEARCH_STORE_LEGACY_PDF_CONTENT === 'true';

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
export function getSearchLang(lang: string) {
  return ALLOWED_SEARCH_LANGS[lang] ?? ALLOWED_SEARCH_LANGS[DEFAULT_LANG];
}

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

/////////////////////////////////////
// Database Environement Variables //
/////////////////////////////////////
// Can be undefined, so tests can run without setting it. In production, TypeORM will throw an exception if not defined.
export const DB_CONNECTION_POOL_SIZE: number = +process.env.DB_CONNECTION_POOL_SIZE! || 10;
export const DB_READ_REPLICA_CONNECTIONS: string[] = process.env.DB_READ_REPLICA_CONNECTIONS
  ? process.env.DB_READ_REPLICA_CONNECTIONS?.split(',')
  : [];
