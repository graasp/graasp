import { ClientConfiguration, Interceptor, createPool } from 'slonik';

import { FastifyPluginAsync } from 'fastify';

import { Database } from '@graasp/sdk';

import { MAXIMUM_POOL_SIZE } from '../util/config';

export interface DatabasePluginOptions {
  uri: string;
  readReplicaUris?: Array<string>;
  logs: boolean;
}

const plugin: FastifyPluginAsync<DatabasePluginOptions> = async (
  fastify,
  { uri, readReplicaUris, logs },
) => {
  const options: Partial<ClientConfiguration> = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeParsers: [] as any[],
    maximumPoolSize: MAXIMUM_POOL_SIZE,
    idleTimeout: 30000,
  };

  if (logs) {
    const queryLoggingInterceptor =
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('slonik-interceptor-query-logging').createQueryLoggingInterceptor();

    // modifies options in-place!
    Object.assign(options, { interceptors: [queryLoggingInterceptor] });
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
    Object.assign(options, { interceptors: [...options.interceptors, readOnlyInterceptor] });
  }

  const pool = createPool(uri, options);
  fastify.decorate('db', { pool } as Database);
};

export default plugin;
