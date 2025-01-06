import { DataSource } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';

import { MemberFactory } from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import { Account } from './entities/account';
import { AccountRepository } from './repository';

describe('AccountRepository', () => {
  let db: DataSource;

  let repository: AccountRepository;
  let accountRawRepository;

  beforeAll(async () => {
    db = await AppDataSource.initialize();
    await db.runMigrations();
    repository = new AccountRepository(db.manager);
    accountRawRepository = db.getRepository(Account);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await db.destroy();
  });

  describe('get', () => {
    it('get account', async () => {
      const member = await accountRawRepository.save(MemberFactory());

      const rawAccount = await repository.get(member.id);
      expect(rawAccount).toEqual(member);
    });

    it('return null for undefined id', async () => {
      const rawAccount = await repository.get(undefined!);
      expect(rawAccount).toBeUndefined();

      const rawAccount2 = await repository.get(null!);
      expect(rawAccount2).toBeUndefined();
    });

    it('return null for unknown id', async () => {
      const rawAccount = await repository.get(uuidV4());
      expect(rawAccount).toBeUndefined();
    });
  });
});
