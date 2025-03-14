import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { resolve } from 'node:path';

import type { FastifyPluginAsync } from 'fastify';

import { client, db } from '../drizzle/db.js';

const plugin: FastifyPluginAsync = async (_fastify) => {
  // connect drizzle to database
  await client.connect();

  // This command run all migrations from the migrations folder and apply changes to the database
  // WARNING: This command needs to reference the drizzle folder from the location of execution of node (dist folder...) this is why the path is weird.
  // await migrate(db, {
  //   migrationsFolder: resolve(__dirname, '../../src/drizzle'),
  // });
};

export default plugin;
