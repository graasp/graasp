import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

import * as relations from './relations';
import * as schema from './schema';

// TODO: https://orm.drizzle.team/docs/drizzle-kit-migrate#applied-migrations-log-in-the-database
export const client = new Client({
  connectionString: process.env.DB_CONNECTION,
  // host: process.env.DB_HOST!,
  // port: Number(process.env.DB_PORT!),
  // user: process.env.DB_USERNAME!,
  // password: process.env.DB_PASSWORD!,
  // database: process.env.DB_NAME!,
  ssl:
    process.env.NODE_ENV === 'production' &&
    // disable SSL in local, only set the var for it to disable the use of SSL
    !process.env.DB_DISABLE_SSL,
});
// { schema } is used for relational queries
export const db = drizzle({
  client,
  schema: { ...schema, ...relations },
  // logger: true,
});
export type DBConnection = Omit<typeof db, '$client'>;
