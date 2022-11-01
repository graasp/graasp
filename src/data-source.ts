import 'reflect-metadata';
import {  DataSource } from 'typeorm';

import { Item } from './entity/Item';
import { Member } from './entity/Member';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'docker',
  password: 'docker',
  database: 'typeorm',
  synchronize: true,
  logging: false,
  entities: [Member, Item],
  migrations: [],
  subscribers: [],
});
