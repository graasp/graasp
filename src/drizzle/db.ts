import { drizzle } from 'drizzle-orm/node-postgres';
import { withReplicas } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';

import { DB_CONNECTION_POOL_SIZE, DB_READ_REPLICA_CONNECTIONS } from '../config/db';
import * as relations from './relations';
import * as schema from './schema';

export const client = new Pool({
  connectionString: process.env.DB_CONNECTION,
  max: DB_CONNECTION_POOL_SIZE,
});

// { schema } is used for relational queries
export const primaryDb = drizzle({
  client,
  schema: { ...schema, ...relations },
  logger: process.env.DATABASE_LOGS === 'true',
});

const readReplica = DB_READ_REPLICA_CONNECTIONS[0]
  ? drizzle({
      client: new Pool({
        connectionString: DB_READ_REPLICA_CONNECTIONS[0],
        max: DB_CONNECTION_POOL_SIZE,
      }),
      schema: { ...schema, ...relations },
      logger: process.env.DATABASE_LOGS === 'true',
    })
  : undefined;

export const db = readReplica ? withReplicas(primaryDb, [readReplica]) : primaryDb;

export type DBConnection = Omit<typeof db, '$client'>;
