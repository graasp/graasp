import dotenv from 'dotenv';
import path from 'path';

import { Context, FileItemType, ItemSettings, ItemType, S3FileConfiguration } from '@graasp/sdk';

enum Environment {
  production = 'production',
  staging = 'staging',
  development = 'development',
  test = 'test',
}

export let ENVIRONMENT: Environment;

switch (process.env.NODE_ENV) {
  case Environment.production:
    dotenv.config({ path: '.env.production' });
    ENVIRONMENT = Environment.production;
    break;
  case Environment.staging:
    dotenv.config({ path: '.env.staging' });
    ENVIRONMENT = Environment.staging;
    break;
  case Environment.test:
    dotenv.config({ path: '.env.test' });
    ENVIRONMENT = Environment.test;
    break;
  default:
    dotenv.config({ path: '.env.development' });
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
    name: Context.BUILDER,
    hostname: new URL(process.env.BUILDER_CLIENT_HOST ?? DEFAULT_HOST).hostname,
  },
  {
    name: Context.PLAYER,
    hostname: new URL(process.env.PLAYER_CLIENT_HOST ?? DEFAULT_HOST).hostname,
  },
  {
    name: Context.LIBRARY,
    hostname: new URL(process.env.EXPLORER_CLIENT_HOST ?? DEFAULT_HOST).hostname,
  },
];

export const PROTOCOL = process.env.PROTOCOL || 'http';
export const HOSTNAME = process.env.HOSTNAME || 'localhost';

export const PORT = process.env.PORT ? +process.env.PORT : 3000;
export const HOST = `${HOSTNAME}:${PORT}`;

if (!process.env.COOKIE_DOMAIN) {
  throw new Error('COOKIE_DOMAIN is undefined');
}

export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
export const CORS_ORIGIN_REGEX = process.env.CORS_ORIGIN_REGEX;

export const CLIENT_HOST = process.env.CLIENT_HOST;
export const AUTH_CLIENT_HOST = process.env.AUTH_CLIENT_HOST;
export const EMAIL_LINKS_HOST = process.env.EMAIL_LINKS_HOST || HOST;

// export const PG_CONNECTION_URI = process.env.PG_CONNECTION_URI;
// export const PG_READ_REPLICAS_CONNECTION_URIS =
//   // note: we don't use the elvis operator because we also want to exclude e.g. empty string
//   process.env.PG_READ_REPLICAS_CONNECTION_URIS
//     ? process.env.PG_READ_REPLICAS_CONNECTION_URIS.split(',')
//     : undefined;
export const DISABLE_LOGS = process.env.DISABLE_LOGS === 'true';
export const DATABASE_LOGS = process.env.DATABASE_LOGS === 'true';

// if (!PG_CONNECTION_URI && !TEST) {
//   console.error('PG_CONNECTION_URI environment variable missing.');
//   process.exit(1);
// }

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

// Graasp limits

/**
 * Maximum connections to the DB for slonik
 * https://wiki.postgresql.org/wiki/Number_Of_Database_Connections
 * should be around ((core_count * 2) + effective_spindle_count), to be tuned wrt effective workload
 */
export const MAXIMUM_POOL_SIZE = process.env.MAXIMUM_POOL_SIZE
  ? parseInt(process.env.MAXIMUM_POOL_SIZE)
  : 20;

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

export const H5P_CONTENT_REGION = process.env.H5P_CONTENT_REGION;
export const H5P_CONTENT_BUCKET = process.env.H5P_CONTENT_BUCKET;
export const H5P_CONTENT_ACCESS_KEY_ID = process.env.H5P_CONTENT_ACCESS_KEY_ID;
export const H5P_CONTENT_SECRET_ACCESS_KEY = process.env.H5P_CONTENT_SECRET_ACCESS_KEY;

export const ETHERPAD_URL = process.env.ETHERPAD_URL;
export const ETHERPAD_PUBLIC_URL = process.env.ETHERPAD_PUBLIC_URL;
export const ETHERPAD_API_KEY = process.env.ETHERPAD_API_KEY;
export const ETHERPAD_COOKIE_DOMAIN = process.env.ETHERPAD_COOKIE_DOMAIN;

export const H5P_CONTENT_PLUGIN_OPTIONS = {
  s3Region: H5P_CONTENT_REGION,
  s3Bucket: H5P_CONTENT_BUCKET,
  s3AccessKeyId: H5P_CONTENT_ACCESS_KEY_ID,
  s3SecretAccessKey: H5P_CONTENT_SECRET_ACCESS_KEY,
};

export const FILE_ITEM_TYPE: FileItemType = S3_FILE_ITEM_PLUGIN
  ? ItemType.S3_FILE
  : ItemType.LOCAL_FILE;

if (!process.env.EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN) {
  throw new Error('EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN is not defined');
}
export const EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN =
  process.env.EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN;

// Graasp apps
export const APPS_PLUGIN = process.env.APPS_PLUGIN === 'true';
if (!process.env.APPS_JWT_SECRET) {
  throw new Error('APPS_JWT_SECRET is not defined');
}
export const APPS_JWT_SECRET = process.env.APPS_JWT_SECRET;

// Graasp websockets
export const WEBSOCKETS_PLUGIN = process.env.WEBSOCKETS_PLUGIN === 'true';
export const REDIS_HOST = process.env.REDIS_HOST;
export const REDIS_PORT = process.env.REDIS_PORT;
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
export const REDIS_USERNAME = process.env.REDIS_USERNAME;

// Graasp public items
export const PUBLIC_PLUGIN = process.env.PUBLIC_PLUGIN === 'true';
export const HIDDEN_TAG_ID = process.env.HIDDEN_TAG_ID;
export const PUBLISHED_TAG_ID = process.env.PUBLISHED_TAG_ID;
export const PUBLIC_TAG_ID = process.env.PUBLIC_TAG_ID;
export const LOGIN_ITEM_TAG_ID = process.env.LOGIN_ITEM_TAG_ID;

// Graasp hidden
export const HIDDEN_ITEMS_PLUGIN = process.env.HIDDEN_ITEMS_PLUGIN
  ? process.env.HIDDEN_ITEMS_PLUGIN === 'true'
  : true;

// actions
export const SAVE_ACTIONS = process.env.SAVE_ACTIONS === 'true';

// validation
export const IMAGE_CLASSIFIER_API = process.env.IMAGE_CLASSIFIER_API;

export const FILES_PATH_PREFIX = process.env.FILES_PATH_PREFIX;
export const AVATARS_PATH_PREFIX = process.env.AVATARS_PATH_PREFIX;
export const THUMBNAILS_PATH_PREFIX = process.env.THUMBNAILS_PATH_PREFIX;
export const H5P_PATH_PREFIX = process.env.H5P_PATH_PREFIX;

export const FILE_ITEM_PLUGIN_OPTIONS = { storageRootPath: FILE_STORAGE_ROOT_PATH ?? 'root' };

export const ITEMS_ROUTE_PREFIX = '/items';
export const APP_ITEMS_PREFIX = '/app-items';
export const THUMBNAILS_ROUTE_PREFIX = '/thumbnails';
export const SUBSCRIPTION_ROUTE_PREFIX = '/subscriptions';

if (!process.env.APPS_PUBLISHER_ID) {
  throw new Error('APPS_PUBLISHER_ID is not defined');
}
export const APPS_PUBLISHER_ID = process.env.APPS_PUBLISHER_ID;

export const DEFAULT_ITEM_SETTINGS: ItemSettings = {
  hasThumbnail: false,
};

// Stripe
export const SUBSCRIPTION_PLUGIN = process.env.SUBSCRIPTION_PLUGIN === 'true';
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
export const STRIPE_DEFAULT_PLAN_PRICE_ID = process.env.STRIPE_DEFAULT_PLAN_PRICE_ID;

export const REDIRECT_URL = `//${CLIENT_HOST}/redirect`;

// used for hashing password
export const SALT_ROUNDS = 10;

export const TMP_FOLDER = path.resolve(__dirname, '../..', 'tmp');

export const VIEW_UNKNOWN_NAME = 'unknown';

export const RECAPTCHA_SECRET_ACCESS_KEY = process.env.RECAPTCHA_SECRET_ACCESS_KEY;
if (!RECAPTCHA_SECRET_ACCESS_KEY) {
  console.error('RECAPTCHA_SECRET_ACCESS_KEY environment variable missing.');
  process.exit(1);
}
export const RECAPTCHA_VERIFY_LINK = 'https://www.google.com/recaptcha/api/siteverify';
export const RECAPTCHA_SCORE_THRESHOLD = 0.5;
