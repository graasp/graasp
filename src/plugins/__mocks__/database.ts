
import { FastifyPluginAsync } from 'fastify';
import { DataSource } from 'typeorm';
import { Member } from '../../services/members/member';
import { Item } from '../../services/items/entities/Item';
import { ItemMembership } from '../../services/item-memberships/entities/ItemMembership';

import { DatabasePluginOptions } from '../database';
import { MemberPassword } from '../auth/entities/password';

const plugin: FastifyPluginAsync<DatabasePluginOptions> = async (fastify) => {
 

 const AppDataSource = new DataSource({
  type: 'sqlite',
  // host: 'localhost',
  // port: 5432,
  // username: 'docker',
  // password: 'docker',
  database: ':memory:',
  synchronize: true, // TODO: CHANGE
  logging: false,
  entities: [Member, Item, ItemMembership, MemberPassword],
});


  await AppDataSource.initialize();

  fastify.decorate('db', AppDataSource);
};

export default plugin;
