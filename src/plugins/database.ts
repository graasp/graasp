import { createPool, DatabasePool, DatabaseTransactionConnection } from 'slonik';
import { FastifyPluginAsync } from 'fastify';

export type DatabasePoolHandler = DatabasePool;
export type DatabaseTransactionHandler = DatabaseTransactionConnection;

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
  }
}

export interface Database {
  pool: DatabasePoolHandler;
}

export interface DatabasePluginOptions {
  uri: string;
  logs: boolean;
}

const plugin: FastifyPluginAsync<DatabasePluginOptions> = async (fastify, { uri, logs }) => {
  const options = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeParsers: [] as any[],
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
