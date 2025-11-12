import os from 'os';

import { ClientManager, Context, DEFAULT_LANG, GPTVersion, type GPTVersionType } from '@graasp/sdk';

import { requiredEnvVar } from '../config/helpers';
import type {
  LocalFileConfiguration,
  S3FileConfiguration,
} from '../services/file/interfaces/configuration';
import { FileStorage, type FileStorageType } from '../services/file/types';
import { API_KEY_FORMAT } from '../services/item/plugins/etherpad/serviceConfig';
import { validateEnv } from './validators/utils';
import { RegexValidator, UrlValidator } from './validators/validators';

export const LOG_LEVEL: string | undefined = process.env.LOG_LEVEL;

export const APP_VERSION = process.env.APP_VERSION;
export const BUILD_TIMESTAMP = process.env.BUILD_TIMESTAMP;

export const CLIENT_HOST = process.env.CLIENT_HOST ?? 'http://localhost:3114';

export const LIBRARY_HOST = process.env.LIBRARY_CLIENT_HOST ?? CLIENT_HOST;

// Fallback to the server-provided integration is only available in dev
export const H5P_INTEGRATION_URL =
  process.env.H5P_INTEGRATION_URL ?? 'http://localhost:3000/h5p-integration';

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
  if (!process.env.H5P_STORAGE_ROOT_PATH) {
    throw new Error('H5P local storage root path missing');
  }
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

// Etherpad
export const ETHERPAD_URL = validateEnv('ETHERPAD_URL', new UrlValidator());
export const ETHERPAD_PUBLIC_URL = process.env.ETHERPAD_PUBLIC_URL;
export const ETHERPAD_API_KEY = validateEnv('ETHERPAD_API_KEY', new RegexValidator(API_KEY_FORMAT));
export const ETHERPAD_COOKIE_DOMAIN = process.env.ETHERPAD_COOKIE_DOMAIN;

export const EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN = requiredEnvVar(
  'EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN',
);

// validation
export const IMAGE_CLASSIFIER_API =
  process.env.IMAGE_CLASSIFIER_API ?? 'http://localhost:8080/infer';

export const ITEMS_ROUTE_PREFIX = '/api/items';
export const APP_ITEMS_PREFIX = '/api/app-items';
export const THUMBNAILS_ROUTE_PREFIX = '/thumbnails';

export const MEMBER_PROFILE_ROUTE_PREFIX = '/profile';
export const MEMBER_EXPORT_DATA_ROUTE_PREFIX = '/export-data';

export const APPS_PUBLISHER_ID = requiredEnvVar('APPS_PUBLISHER_ID');
export const GRAASPER_CREATOR_ID = requiredEnvVar('GRAASPER_CREATOR_ID');

export const TMP_FOLDER = os.tmpdir();

export const RECAPTCHA_SECRET_ACCESS_KEY = requiredEnvVar('RECAPTCHA_SECRET_ACCESS_KEY');
export const RECAPTCHA_VERIFY_LINK = 'https://www.google.com/recaptcha/api/siteverify';
export const RECAPTCHA_SCORE_THRESHOLD = 0.5;

export const GET_FEATURED_ITEMS_MAXIMUM = 50;
export const GET_MOST_LIKED_ITEMS_MAXIMUM = 50;
export const GET_MOST_RECENT_ITEMS_MAXIMUM = 50;

// Graasp Search
export const MEILISEARCH_URL = process.env.MEILISEARCH_URL || '';
export const MEILISEARCH_MASTER_KEY = process.env.MEILISEARCH_MASTER_KEY;
export const MEILISEARCH_REBUILD_SECRET = process.env.MEILISEARCH_REBUILD_SECRET;
export const MEILISEARCH_STORE_LEGACY_PDF_CONTENT: boolean =
  process.env.MEILISEARCH_STORE_LEGACY_PDF_CONTENT === 'true';

// OpenAI
const getGptVersion = (): GPTVersionType => {
  const GPTVersionEnv = process.env.OPENAI_GPT_VERSION ?? '';
  if ((Object.values(GPTVersion) as string[]).includes(GPTVersionEnv)) {
    return GPTVersionEnv as GPTVersionType;
  }
  return GPTVersion.GPT_5_NANO;
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
