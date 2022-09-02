import { ClientConfiguration, createPool } from 'slonik';

import { FastifyPluginAsync } from 'fastify';

import { Database } from '@graasp/sdk';

import { MAXIMUM_POOL_SIZE } from '../util/config';

export interface DatabasePluginOptions {
  uri: string;
  logs: boolean;
}

const plugin: FastifyPluginAsync<DatabasePluginOptions> = async (fastify, { uri, logs }) => {
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
    Object.assign(options, { interceptors: [queryLoggingInterceptor] });
  }

  const pool = createPool(uri, options);
  fastify.decorate('db', { pool } as Database);
};

export default plugin;
