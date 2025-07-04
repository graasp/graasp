import 'dotenv/config';

import type { FastifyPluginAsync } from 'fastify';

import { client } from '../drizzle/db';

const databasePlugin: FastifyPluginAsync = async (_fastify) => {
  // connect drizzle to database
  await client.connect();
};
export { databasePlugin };
export default databasePlugin;
