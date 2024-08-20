import { v4 as uuidV4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import build, { clearDatabase } from '../../../test/app';
import { saveMember } from '../member/test/fixtures/members';
import { AccountRepository } from './repository';

const accountRepository = new AccountRepository();

describe('MemberRepository', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    ({ app } = await build());
  });
  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('get', () => {
    it('get member', async () => {
      const member = await saveMember();

      const rawAccount = await accountRepository.get(member.id);
      expect(rawAccount).toEqual(member);
    });

    it('return null for undefined id', async () => {
      const rawAccount = await accountRepository.get(undefined!);
      expect(rawAccount).toBeUndefined();

      const rawAccount2 = await accountRepository.get(null!);
      expect(rawAccount2).toBeUndefined();
    });

    it('return null for unknown id', async () => {
      const rawAccount = await accountRepository.get(uuidV4());
      expect(rawAccount).toBeUndefined();
    });
  });
});
