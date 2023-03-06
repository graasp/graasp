import { ClientConfiguration, Interceptor, createPool } from 'slonik';

import { FastifyPluginAsync } from 'fastify';

import { MAXIMUM_POOL_SIZE } from '../util/config';
import { AppDataSource } from './datasource';

export interface DatabasePluginOptions {
  // uri: string;
  readReplicaUris?: Array<string>;
  logs: boolean;
}

const plugin: FastifyPluginAsync<DatabasePluginOptions> = async (
  fastify,
  {  readReplicaUris, logs },
) => {
  console.log('DB START');
  const db = AppDataSource;
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize().catch(e => console.log(e));
  }
  fastify.decorate('db', db);

  console.log('DB END');

  const options: Partial<ClientConfiguration> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeParsers: [] as any[],
    maximumPoolSize: MAXIMUM_POOL_SIZE,
    idleTimeout: 30000,
  };

  /**
   * Mutates the provided options in-place with a new interceptor
   * @param options options to be mutated
   * @param interceptor function to be added
   */
  function addInterceptor(options: Partial<ClientConfiguration>, interceptor: Interceptor) {
    Object.assign(options, {
      interceptors: options.interceptors ? [...options.interceptors, interceptor] : [interceptor],
    });
  }

  if (logs) {
    const queryLoggingInterceptor =
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('slonik-interceptor-query-logging').createQueryLoggingInterceptor();

    // modifies options in-place!
    addInterceptor(options, queryLoggingInterceptor);
  }

  // read replicas load balancing
  // see https://github.com/gajus/slonik#routing-queries-to-different-connections
  if (readReplicaUris) {
    const readOnlyPools = readReplicaUris.map((uri) => createPool(uri, options));

    const readOnlyInterceptor: Interceptor = {
      beforePoolConnection: (connectionContext) => {
        if (!connectionContext.query) {
          // Returning null falls back to using the DatabasePool from which the query originates.
          return null;
        }

        if (!connectionContext.query.sql.trim().startsWith('SELECT ')) {
          // Returning null falls back to using the DatabasePool from which the query originates.
          return null;
        }

        // This is a convention for the edge-cases where a SELECT query includes a volatile function.
        // Adding a @volatile comment anywhere into the query bypasses the read-only route, e.g.
        // sql.unsafe`
        //   # @volatile
        //   SELECT write_log()
        // `
        if (connectionContext.query.sql.includes('@volatile')) {
          // Returning null falls back to using the DatabasePool from which the query originates.
          return null;
        }

        // Select a read replica at random
        // Returning an instance of DatabasePool will attempt to run the query using the other connection pool.
        // Note that all other interceptors of the pool that the query originated from are short-circuited.
        return readOnlyPools[Math.floor(Math.random() * readOnlyPools.length)];
      },
    };

    // modifies options in-place!
    addInterceptor(options, readOnlyInterceptor);
  }
};

export default plugin;
