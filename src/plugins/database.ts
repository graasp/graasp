import { FastifyPluginAsync } from 'fastify';

import { AppDataSource } from './datasource';

export interface DatabasePluginOptions {
  // uri: string;
  readReplicaUris?: Array<string>;
  logs: boolean;
}

const plugin: FastifyPluginAsync<DatabasePluginOptions> = async (
  fastify,
  { readReplicaUris, logs },
) => {
  const db = AppDataSource;
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  fastify.decorate('db', db);
};

export default plugin;
