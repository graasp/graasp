import { getEnv } from './env';

getEnv();

/////////////////////////////////////
// Database Environement Variables //
/////////////////////////////////////
// Can be undefined, so tests can run without setting it.
export const DB_CONNECTION_POOL_SIZE: number = +process.env.DB_CONNECTION_POOL_SIZE! || 10;
export const DB_READ_REPLICA_CONNECTIONS: string[] = process.env.DB_READ_REPLICA_CONNECTIONS
  ? process.env.DB_READ_REPLICA_CONNECTIONS?.split(',')
  : [];
