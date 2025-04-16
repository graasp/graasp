import { drizzle } from 'drizzle-orm/node-postgres';
import { withReplicas } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

import { DB_CONNECTION_POOL_SIZE, DB_READ_REPLICA_HOSTS } from '../utils/config';
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
export const primaryDb = drizzle({
  client,
  schema: { ...schema, ...relations },
  logger: true,
});

const readReplicas = DB_READ_REPLICA_HOSTS.map(
  (host) =>
    drizzle({
      client: new Pool({
        host,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        max: DB_CONNECTION_POOL_SIZE,
      }),
      schema: { ...schema, ...relations },
      logger: true,
    }),
  // TODO: type does not work well
) as any;

export const db = readReplicas.length ? withReplicas(primaryDb, readReplicas) : primaryDb;

export type DBConnection = Omit<typeof db, '$client'>;
