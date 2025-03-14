import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

import * as enums from './enums.js';
import * as relations from './relations.js';
import * as schema from './schema.js';

// TODO: https://orm.drizzle.team/docs/drizzle-kit-migrate#applied-migrations-log-in-the-database
export const client = new Client({
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT!),
  user: process.env.DB_USERNAME!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
});
// { schema } is used for relational queries
export const db = drizzle({
  client,
  schema: { ...schema, ...relations, ...enums },
});
export type DBConnection = Omit<typeof db, '$client'>;
