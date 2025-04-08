import { drizzle } from 'drizzle-orm/node-postgres';
import { Client as NodePGClient, native } from 'pg';

import * as relations from './relations';
import * as schema from './schema';

// use native if available
const { Client = NodePGClient } = native ?? { Client: NodePGClient };

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
  schema: { ...schema, ...relations },
  // logger: true,
});
export type DBConnection = Omit<typeof db, '$client'>;
