import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env')) {
  dotenv.config({ path: '.env' });
} else {
  dotenv.config({ path: '.env.development' });
}

export const ENVIRONMENT = process.env.NODE_ENV || 'develoment';
const prod = ENVIRONMENT === 'production';
const { PORT: port } = process.env;

if (!port) {
  console.error('PORT environment variable missing.');
  process.exit(1);
}

export const PROTOCOL = process.env.PROTOCOL || 'http';
export const HOSTNAME = process.env.HOSTNAME || 'localhost';

export const PORT = !prod ? port :
// if launched using pm2 (multiple instances), get the intance number
(port + (parseInt(process.env['NODE_APP_INSTANCE'], 10) || 0));

export const HOST = prod ? HOSTNAME : `${HOSTNAME}:${PORT}`;

export const { PG_CONNECTION_URI, DATABASE_LOGS, DISABLE_LOGS } = process.env;

if (!PG_CONNECTION_URI) {
  console.error('PG_CONNECTION_URI environment variable missing.');
  process.exit(1);
}

// Mailer config
export const MAILER_CONFIG_SMTP_HOST = process.env.MAILER_CONFIG_SMTP_HOST;
export const MAILER_CONFIG_USERNAME = process.env.MAILER_CONFIG_USERNAME;
export const MAILER_CONFIG_PASSWORD = process.env.MAILER_CONFIG_PASSWORD;
export const MAILER_CONFIG_FROM_EMAIL = 'no-reply@graasp.org';

// Graasp constants

/**
 * Graasp's "internal" actor
 */
export const GRAASP_ACTOR = { id: '12345678-1234-1234-1234-123456789012' };
/**
 * JWT secret
 */
export const JWT_SECRET = process.env.JWT_SECRET;
/**
 * Register (JWT) token expiration, in minutes
 */
export const REGISTER_TOKEN_EXPIRATION_IN_MINUTES = 60;
/**
 * Login (JWT) token expiration, in minutes
 */
export const LOGIN_TOKEN_EXPIRATION_IN_MINUTES = 30;

// Graasp limits

/**
 * Maximun items tree depth
 */
export const MAX_TREE_LEVELS = 15;
/**
 * Maximun number of children an item can have
 */
export const MAX_NUMBER_OF_CHILDREN = 10;
/**
 * Maximun number of descendants (in the item's subtree) for a `delete`
 */
export const MAX_DESCENDANTS_FOR_DELETE = 5;
/**
 * Maximun number of descendants (in the item's subtree) for a `update`
 */
export const MAX_DESCENDANTS_FOR_UPDATE = 5;
/**
 * Maximun number of descendants (in the item's subtree) for a `move`
 */
export const MAX_DESCENDANTS_FOR_MOVE = 15;
/**
 * Maximun number of descendants (in the item's subtree) for a `copy`
 */
export const MAX_DESCENDANTS_FOR_COPY = 20;

/**
 * Maximun number of targets in a "many" request that only reads data (`get`)
 */
export const MAX_TARGETS_FOR_READ_REQUEST = 100;
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


// Graasp file item
// TODO: should this be here?
export const FILE_STORAGE_ROOT_PATH = process.env.FILE_STORAGE_ROOT_PATH || process.env.TMPDIR;
