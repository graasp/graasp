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

export const PORT = !prod ? port :
  // if launched using pm2 (multiple instances), get the intance number
  (port + (parseInt(process.env['NODE_APP_INSTANCE'], 10) || 0));

export const { PG_CONNECTION_URI, DATABASE_LOGS, DISABLE_LOGS } = process.env;

if (!PG_CONNECTION_URI) {
  console.error('PG_CONNECTION_URI environment variable missing.');
  process.exit(1);
}

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
