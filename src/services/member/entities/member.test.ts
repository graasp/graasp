import { faker } from '@faker-js/faker';

import { FastifyInstance } from 'fastify';

import build, { clearDatabase } from '../../../../test/app';
import { AppDataSource } from '../../../plugins/datasource';
import { Member } from './member';

// mock datasource
jest.mock('../../../plugins/datasource');
const memberRawRepository = AppDataSource.getRepository(Member);

describe('MemberRepository', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    ({ app } = await build({ member: null }));
  });
  afterEach(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  describe('constraints', () => {
    it('email is not nullable', async () => {
      expect(async () => {
        const memberWithoutEmail = new Member();
        memberWithoutEmail.name = 'memberWithoutEmail';
        await memberRawRepository.save(memberWithoutEmail);
      }).rejects.toThrow();
      const memberWithEmail = new Member();
      memberWithEmail.name = 'memberWithEmail';
      memberWithEmail.email = faker.internet.email().toLowerCase();
      await memberRawRepository.save(memberWithEmail);
    });
  });
});
