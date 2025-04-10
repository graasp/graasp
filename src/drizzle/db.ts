import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

import * as relations from './relations';
import * as schema from './schema';

// TODO: https://orm.drizzle.team/docs/drizzle-kit-migrate#applied-migrations-log-in-the-database
export const client = new Client({
  connectionString: process.env.DB_CONNECTION,
});
// { schema } is used for relational queries
export const db = drizzle({
  client,
  schema: { ...schema, ...relations },
  // logger: true,
});
export type DBConnection = Omit<typeof db, '$client'>;
