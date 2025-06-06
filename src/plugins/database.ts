import 'dotenv/config';

import type { FastifyPluginAsync } from 'fastify';

import { client } from '../drizzle/db';

const plugin: FastifyPluginAsync = async (_fastify) => {
  // connect drizzle to database
  await client.connect();
};

export default plugin;
