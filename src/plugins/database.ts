import { DataSource } from 'typeorm';

import { FastifyPluginAsync } from 'fastify';

import { Member } from '../services/members/member';
import { MAXIMUM_POOL_SIZE } from '../util/config';
import { Item } from '../services/items/entities/Item';
import { ItemMembership } from '../services/item-memberships/entities/ItemMembership';
import { MemberPassword } from './auth/entities/password';
import { AppDataSource } from './datasource';

export interface DatabasePluginOptions {
  uri: string;
  logs: boolean;
}

const plugin: FastifyPluginAsync<DatabasePluginOptions> = async (fastify, { uri, logs }) => {
  // const options: Partial<ClientConfiguration> = {
  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   typeParsers: [] as any[],
  //   maximumPoolSize: MAXIMUM_POOL_SIZE,
  //   idleTimeout: 30000,
  // };

  // if (logs) {
  //   const queryLoggingInterceptor =
  //     // eslint-disable-next-line @typescript-eslint/no-var-requires
  //     require('slonik-interceptor-query-logging').createQueryLoggingInterceptor();
  //   Object.assign(options, { interceptors: [queryLoggingInterceptor] });
  // }

  // const pool = createPool(uri, options);

  await AppDataSource.initialize();

  fastify.decorate('db', AppDataSource);
};

export default plugin;
