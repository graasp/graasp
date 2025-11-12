import { v4 as uuidV4 } from 'uuid';
import { describe, expect, it } from 'vitest';

import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import type { AccountRaw } from '../../drizzle/types';
import { AccountDTO, AccountRepository } from './account.repository';

const accountRepository = new AccountRepository();

describe('AccountRepository', () => {
  describe('get', () => {
    it('get member', async () => {
      const {
        members: [member],
      } = await seedFromJson({ members: [{}] });

      const rawAccount = await accountRepository.get(db, member.id);
      expect(rawAccount).toEqual(AccountDTO.from(member as AccountRaw));
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
