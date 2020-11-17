import { createPool, DatabasePoolType, DatabaseTransactionConnectionType } from 'slonik';
import { FastifyInstance } from 'fastify';

export type DatabasePoolHandler = DatabasePoolType;
export type DatabaseTransactionHandler = DatabaseTransactionConnectionType;

export interface Database {
  pool: DatabasePoolHandler;
}

export default async (fastify: FastifyInstance, { uri, logs }: { uri: string; logs: string }): Promise<void> => {
  const options = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeParsers: [] as any[]
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
