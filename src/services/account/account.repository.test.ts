import { v4 as uuidV4 } from 'uuid';

import { client, db } from '../../drizzle/db';
import { saveMember } from '../member/test/fixtures/members';
import { AccountDTO, AccountRepository } from './account.repository';

const accountRepository = new AccountRepository();

describe('AccountRepository', () => {
  beforeAll(async () => {
    await client.connect();
  });
  afterAll(async () => {
    await client.end();
  });

  describe('get', () => {
    it('get member', async () => {
      const member = await saveMember();

      const rawAccount = await accountRepository.get(db, member.id);
      expect(rawAccount).toEqual(AccountDTO.from(member));
    });

    it('return undefined for undefined id', async () => {
      const rawAccount = await accountRepository.get(db, undefined!);
      expect(rawAccount.toMaybeUser()).toBeUndefined();

      const rawAccount2 = await accountRepository.get(db, null!);
      expect(rawAccount2.toMaybeUser()).toBeUndefined();
    });

    it('return null for unknown id', async () => {
      const rawAccount = await accountRepository.get(db, uuidV4());
      expect(rawAccount.toMaybeUser()).toBeUndefined();
    });
  });
});
