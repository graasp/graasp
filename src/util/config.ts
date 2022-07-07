import dotenv from 'dotenv';
import { ServiceMethod } from 'graasp-plugin-file';
import S3 from 'aws-sdk/clients/s3';
import { ItemSettings } from '..';

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

// todo: get from graasp constants
export const CLIENT_HOSTS = [
  {
    name: 'builder',
    hostname: 'builder.graasp.org',
  },
  {
    name: 'player',
    hostname: 'player.graasp.org',
  },
  {
    name: 'explorer',
    hostname: 'explorer.graasp.org',
  },
];

const { PORT: port } = process.env;

if (!port && !TEST) {
  console.error('PORT environment variable missing.');
  process.exit(1);
}

export const PROTOCOL = process.env.PROTOCOL || 'http';
export const HOSTNAME = process.env.HOSTNAME || 'localhost';

export const PORT = port;
export const HOST = `${HOSTNAME}:${PORT}`;

export const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN;
export const CORS_ORIGIN_REGEX = process.env.CORS_ORIGIN_REGEX;

export const CLIENT_HOST = process.env.CLIENT_HOST;
export const AUTH_CLIENT_HOST = process.env.AUTH_CLIENT_HOST;
export const EMAIL_LINKS_HOST = process.env.EMAIL_LINKS_HOST || HOST;

export const PG_CONNECTION_URI = process.env.PG_CONNECTION_URI;
export const DISABLE_LOGS = process.env.DISABLE_LOGS === 'true';
export const DATABASE_LOGS = process.env.DATABASE_LOGS === 'true';

if (!PG_CONNECTION_URI && !TEST) {
  console.error('PG_CONNECTION_URI environment variable missing.');
  process.exit(1);
}

// Graasp constants
/**
 * Session cookie key
 */
export const SECURE_SESSION_SECRET_KEY = process.env.SECURE_SESSION_SECRET_KEY;
/**
 * Graasp's "internal" actor
 */
export const GRAASP_ACTOR = { id: '12345678-1234-1234-1234-123456789012' };
/**
 * JWT
 */
export const JWT_SECRET = process.env.JWT_SECRET;
/** Register token expiration, in minutes */
export const REGISTER_TOKEN_EXPIRATION_IN_MINUTES = 60;
/** Login token expiration, in minutes */
export const LOGIN_TOKEN_EXPIRATION_IN_MINUTES = 30;

// Token based auth
export const TOKEN_BASED_AUTH = process.env.TOKEN_BASED_AUTH === 'true';
export const AUTH_TOKEN_JWT_SECRET = process.env.AUTH_TOKEN_JWT_SECRET;
export const REFRESH_TOKEN_JWT_SECRET = process.env.REFRESH_TOKEN_JWT_SECRET;
/** Auth token expiration, in minutes */
export const AUTH_TOKEN_EXPIRATION_IN_MINUTES =
  +process.env.AUTH_TOKEN_EXPIRATION_IN_MINUTES || 10080;
/** Refresh token expiration, in minutes */
export const REFRESH_TOKEN_EXPIRATION_IN_MINUTES =
  +process.env.REFRESH_TOKEN_EXPIRATION_IN_MINUTES || 86400;

// Graasp limits

/**
 * Maximum connections to the DB for slonik
 */
export const MAXIMUM_POOL_SIZE = 30;

/**
 * Maximun items tree depth
 */
export const MAX_TREE_LEVELS = 15;
/**
 * Maximun number of children an item can have
 */
export const MAX_NUMBER_OF_CHILDREN = 100;
/**
 * Maximun number of descendants (in the item's subtree) for a `delete`
 */
export const MAX_DESCENDANTS_FOR_DELETE = 100;
/**
 * Maximun number of descendants (in the item's subtree) for a `update`
 */
export const MAX_DESCENDANTS_FOR_UPDATE = 100;
/**
 * Maximun number of descendants (in the item's subtree) for a `move`
 */
export const MAX_DESCENDANTS_FOR_MOVE = 100;
/**
 * Maximun number of descendants (in the item's subtree) for a `copy`
 */
export const MAX_DESCENDANTS_FOR_COPY = 100;

/**
 * Maximun number of item memberships when deleting all "under" an item
 */
export const MAX_ITEM_MEMBERSHIPS_FOR_DELETE = 100;

/**
 * Maximun number of targets in a "many" request that only reads data (`get`)
 */
export const MAX_TARGETS_FOR_READ_REQUEST = MAX_TREE_LEVELS;
/**
 * Maximun number of targets in a "many" request that modifies data (`update`, `delete`)
 */
export const MAX_TARGETS_FOR_MODIFY_REQUEST = 20;
/**
 * Maximun number of targets in a "many" request for which the server
 * will execute the tasks and return the results in the same request's response.
 *
 * A request with more targets than this limit should get an immediate `202` response,
 * and the results should be pushed to the client (websockets, ...) as they happen.
 */
export const MAX_TARGETS_FOR_MODIFY_REQUEST_W_RESPONSE = 5;

// Graasp mailer config
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
const S3_FILE_ITEM_HOST = process.env.S3_FILE_ITEM_HOST;

let S3_INSTANCE: S3;

// Enable localstack, only create the instance in test or dev environments
// Use the provided endpoint or the aws s3 backend
if ((DEV || TEST) && S3_FILE_ITEM_HOST) {
  S3_INSTANCE = new S3({
    region: S3_FILE_ITEM_REGION,
    useAccelerateEndpoint: false,
    credentials: {
      accessKeyId: S3_FILE_ITEM_ACCESS_KEY_ID,
      secretAccessKey: S3_FILE_ITEM_SECRET_ACCESS_KEY,
    },
    // this is necessary because localstack doesn't support hostnames eg: <bucket>.s3.<region>.amazonaws.com/<key>
    // so it we must use pathStyle buckets eg: localhost:4566/<bucket>/<key>
    s3ForcePathStyle: true,
    // this is necessary to use the localstack instance running on graasp-localstack or localhost
    // this overrides the default endpoint (amazonaws.com) with S3_FILE_ITEM_HOST
    endpoint: S3_FILE_ITEM_HOST,
  });
}

export const S3_FILE_ITEM_PLUGIN_OPTIONS = {
  s3Region: S3_FILE_ITEM_REGION,
  s3Bucket: S3_FILE_ITEM_BUCKET,
  s3AccessKeyId: S3_FILE_ITEM_ACCESS_KEY_ID,
  s3SecretAccessKey: S3_FILE_ITEM_SECRET_ACCESS_KEY,
  s3Instance: S3_INSTANCE,
};

export const SERVICE_METHOD = S3_FILE_ITEM_PLUGIN ? ServiceMethod.S3 : ServiceMethod.LOCAL;

// Graasp embedded link item
// TODO: should this be here?
export const EMBEDDED_LINK_ITEM_PLUGIN = process.env.EMBEDDED_LINK_ITEM_PLUGIN === 'true';
export const EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN =
  process.env.EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN;

// Graasp apps
export const APPS_PLUGIN = process.env.APPS_PLUGIN === 'true';
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

// Graasp chatbox plugin
export const CHATBOX_PLUGIN = process.env.CHATBOX_PLUGIN === 'true';

// actions
export const SAVE_ACTIONS = process.env.SAVE_ACTIONS === 'true';

// validation
export const IMAGE_CLASSIFIER_API = process.env.IMAGE_CLASSIFIER_API;

export const FILES_PATH_PREFIX = process.env.FILES_PATH_PREFIX;
export const AVATARS_PATH_PREFIX = process.env.AVATARS_PATH_PREFIX;
export const THUMBNAILS_PATH_PREFIX = process.env.THUMBNAILS_PATH_PREFIX;

export const FILE_ITEM_PLUGIN_OPTIONS = { storageRootPath: FILE_STORAGE_ROOT_PATH };

export const ITEMS_ROUTE_PREFIX = '/items';
export const PUBLIC_ROUTE_PREFIX = '/p';
export const APP_ITEMS_PREFIX = '/app-items';
export const THUMBNAILS_ROUTE_PREFIX = '/thumbnails';

export const APPS_PUBLISHER_ID = process.env.APPS_PUBLISHER_ID;

export const DEFAULT_ITEM_SETTINGS: Partial<ItemSettings> = {
  hasThumbnail: false,
};
export const DEFAULT_LANG = 'en';

export const REDIRECT_URL = `//${CLIENT_HOST}/redirect`;
