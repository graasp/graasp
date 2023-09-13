import dotenv from 'dotenv';
import os from 'os';

import {
  Context,
  FileItemType,
  ItemType,
  LocalFileConfiguration,
  S3FileConfiguration,
} from '@graasp/sdk';

enum Environment {
  production = 'production',
  staging = 'staging',
  development = 'development',
  test = 'test',
}

export let ENVIRONMENT: Environment;

switch (process.env.NODE_ENV) {
  case Environment.production:
    dotenv.config({ path: '.env.production', override: true });
    ENVIRONMENT = Environment.production;
    break;
  case Environment.staging:
    dotenv.config({ path: '.env.staging', override: true });
    ENVIRONMENT = Environment.staging;
    break;
  case Environment.test:
    dotenv.config({ path: '.env.test', override: true });
    ENVIRONMENT = Environment.test;
    break;
  default:
    dotenv.config({ path: '.env.development', override: true });
    ENVIRONMENT = Environment.development;
    break;
}

export const PROD = ENVIRONMENT === Environment.production;
export const STAGING = ENVIRONMENT === Environment.staging;
export const DEV = ENVIRONMENT === Environment.development;
export const TEST = ENVIRONMENT === Environment.test;

const DEFAULT_HOST = 'http://localhost:3000';

export const CLIENT_HOSTS = [
  {
    name: Context.Builder,
    url: new URL(process.env.BUILDER_CLIENT_HOST ?? DEFAULT_HOST),
  },
  {
    name: Context.Player,
    url: new URL(process.env.PLAYER_CLIENT_HOST ?? DEFAULT_HOST),
  },
  {
    name: Context.Library,
    url: new URL(process.env.EXPLORER_CLIENT_HOST ?? DEFAULT_HOST),
  },
];

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

export const MOBILE_AUTH_URL = new URL(
  process.env.GRAASP_MOBILE_BUILDER || 'https://mobile.graasp.org',
);

export const DISABLE_LOGS = process.env.DISABLE_LOGS === 'true';
export const DATABASE_LOGS = process.env.DATABASE_LOGS === 'true';

// Graasp constants
/**
 * Session cookie key
 */
if (!process.env.SECURE_SESSION_SECRET_KEY) {
  throw new Error('SECURE_SESSION_SECRET_KEY is not defined');
}
export const SECURE_SESSION_SECRET_KEY = process.env.SECURE_SESSION_SECRET_KEY;

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

// Graasp S3 file item
// TODO: should this be here?
export const S3_FILE_ITEM_PLUGIN = process.env.S3_FILE_ITEM_PLUGIN === 'true';
export const S3_FILE_ITEM_REGION = process.env.S3_FILE_ITEM_REGION;
export const S3_FILE_ITEM_BUCKET = process.env.S3_FILE_ITEM_BUCKET;
export const S3_FILE_ITEM_ACCESS_KEY_ID = process.env.S3_FILE_ITEM_ACCESS_KEY_ID;
export const S3_FILE_ITEM_SECRET_ACCESS_KEY = process.env.S3_FILE_ITEM_SECRET_ACCESS_KEY;
export const S3_FILE_ITEM_HOST = process.env.S3_FILE_ITEM_HOST;

export let S3_FILE_ITEM_PLUGIN_OPTIONS: S3FileConfiguration;

if (S3_FILE_ITEM_PLUGIN) {
  if (
    !S3_FILE_ITEM_REGION ||
    !S3_FILE_ITEM_BUCKET ||
    !S3_FILE_ITEM_ACCESS_KEY_ID ||
    !S3_FILE_ITEM_SECRET_ACCESS_KEY
  ) {
    throw new Error('Missing one s3 config');
  }

  S3_FILE_ITEM_PLUGIN_OPTIONS = {
    s3Region: S3_FILE_ITEM_REGION,
    s3Bucket: S3_FILE_ITEM_BUCKET,
    s3AccessKeyId: S3_FILE_ITEM_ACCESS_KEY_ID,
    s3SecretAccessKey: S3_FILE_ITEM_SECRET_ACCESS_KEY,
  };
}

if (!process.env.H5P_PATH_PREFIX) {
  throw new Error('Invalid H5P path prefix');
}
export const H5P_PATH_PREFIX = process.env.H5P_PATH_PREFIX;

// ugly runtime type checking since typescript cannot infer types
// todo: please use a typed env checker library, this is awful
if (
  process.env.H5P_FILE_STORAGE_TYPE !== ItemType.S3_FILE &&
  process.env.H5P_FILE_STORAGE_TYPE !== ItemType.LOCAL_FILE
) {
  throw new Error('Invalid H5P file storage type provided');
}
export const H5P_FILE_STORAGE_TYPE = process.env.H5P_FILE_STORAGE_TYPE as FileItemType;

// ugly runtime type checking since typescript cannot infer types
if (H5P_FILE_STORAGE_TYPE === ItemType.S3_FILE) {
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
if (H5P_FILE_STORAGE_TYPE === ItemType.LOCAL_FILE) {
  if (!process.env.H5P_STORAGE_ROOT_PATH) throw new Error('H5P local storage root path missing');
}
export const H5P_LOCAL_CONFIG = {
  local: {
    storageRootPath: process.env.H5P_STORAGE_ROOT_PATH,
  } as LocalFileConfiguration,
};

// ugly runtime type checking since typescript cannot infer types
export const H5P_FILE_STORAGE_CONFIG =
  H5P_FILE_STORAGE_TYPE === ItemType.S3_FILE ? H5P_S3_CONFIG : H5P_LOCAL_CONFIG;

export const ETHERPAD_URL = process.env.ETHERPAD_URL;
export const ETHERPAD_PUBLIC_URL = process.env.ETHERPAD_PUBLIC_URL;
export const ETHERPAD_API_KEY = process.env.ETHERPAD_API_KEY;
export const ETHERPAD_COOKIE_DOMAIN = process.env.ETHERPAD_COOKIE_DOMAIN;

export const FILE_ITEM_TYPE: FileItemType = S3_FILE_ITEM_PLUGIN
  ? ItemType.S3_FILE
  : ItemType.LOCAL_FILE;

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
export const REDIS_PORT = process.env.REDIS_PORT;
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
export const REDIS_USERNAME = process.env.REDIS_USERNAME;

// validation
export const IMAGE_CLASSIFIER_API = process.env.IMAGE_CLASSIFIER_API;

export const FILE_ITEM_PLUGIN_OPTIONS = { storageRootPath: FILE_STORAGE_ROOT_PATH ?? 'root' };

export const ITEMS_ROUTE_PREFIX = '/items';
export const APP_ITEMS_PREFIX = '/app-items';
export const THUMBNAILS_ROUTE_PREFIX = '/thumbnails';

if (!process.env.APPS_PUBLISHER_ID) {
  throw new Error('APPS_PUBLISHER_ID is not defined');
}
export const APPS_PUBLISHER_ID = process.env.APPS_PUBLISHER_ID;

// Stripe
export const SUBSCRIPTION_PLUGIN = process.env.SUBSCRIPTION_PLUGIN === 'true';
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
export const STRIPE_DEFAULT_PLAN_PRICE_ID = process.env.STRIPE_DEFAULT_PLAN_PRICE_ID;

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
