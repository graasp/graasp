import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { DB_CONNECTION_POOL_SIZE } from '../utils/config';
import * as relations from './relations';
import * as schema from './schema';

export const client = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: DB_CONNECTION_POOL_SIZE,
});

// { schema } is used for relational queries
export const db = drizzle({
  client,
  schema: { ...schema, ...relations },
  // logger: true,
});

export type DBConnection = Omit<typeof db, '$client'>;
