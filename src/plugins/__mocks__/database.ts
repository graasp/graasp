import { FastifyPluginAsync } from 'fastify';
import { createMockPool, createMockQueryResult } from 'slonik';
import { Database, DatabasePluginOptions } from '../database';

const plugin: FastifyPluginAsync<DatabasePluginOptions> = async (fastify) => {
  const { log } = fastify;
  const mockedDb = createMockPool({
    query: async (sql, values) => {
      log.debug('sql, values: ', sql, values);
      return createMockQueryResult([]);
    },
  });

  fastify.decorate('db', { pool: mockedDb } as Database);
};

export default plugin;
