import { DataSource } from 'typeorm';
import { ItemMembership } from '../services/item-memberships/entities/ItemMembership';
import { Item } from '../services/items/entities/Item';
import { Member } from '../services/members/member';
import { MemberPassword } from './auth/entities/password';


  // TODO: USE DB OPTIONS
export const AppDataSource = new DataSource({

  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'docker',
  password: 'docker',
  database: 'typeorm',
  synchronize: true, // TODO: CHANGE
  logging: false,
  entities: [Member, Item, ItemMembership, MemberPassword, ItemMembership],
  subscribers: [],
  migrations: ['migrations/*.js'],
  migrationsTableName: 'custom_migration_table',
});

// AppDataSource.initialize()
//     .then(() => {
//         console.log('Data Source has been initialized!');
//     })
//     .catch((err) => {
//         console.error('Error during Data Source initialization', err);
//     });
