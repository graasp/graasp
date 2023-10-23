import { FastifyPluginAsync } from 'fastify';

import { AppDataSource } from './datasource';

export interface DatabasePluginOptions {
  // uri: string;
  readReplicaUris?: Array<string>;
  logs: boolean;
}

const plugin: FastifyPluginAsync<DatabasePluginOptions> = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { readReplicaUris, logs },
) => {
  const db = AppDataSource;
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  // check schema is sync
  // const databaseUpQueries = (await db.driver.createSchemaBuilder().log()).upQueries;
  // if (databaseUpQueries.length > 0) {
  //   console.error(`${databaseUpQueries.length} schema differences detected in current connection.`);
  //   throw new Error(`${databaseUpQueries.length} schema differences detected in current connection.`);
  // }

  fastify.decorate('db', db);
};

export default plugin;
