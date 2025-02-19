import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';

import { FastifyPluginAsync } from 'fastify';

import { client, db } from '../drizzle/db';

const plugin: FastifyPluginAsync = async () => {
  await client.connect();

  // This command run all migrations from the migrations folder and apply changes to the database
  await migrate(db, { migrationsFolder: resolve(__dirname, './drizzle') });

  // check schema is sync
  // const databaseUpQueries = (await db.driver.createSchemaBuilder().log()).upQueries;
  // if (databaseUpQueries.length > 0) {
  //   console.error(`${databaseUpQueries.length} schema differences detected in current connection.`);
  //   throw new Error(`${databaseUpQueries.length} schema differences detected in current connection.`);
  // }
};

export default plugin;
