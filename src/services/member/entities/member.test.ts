import { faker } from '@faker-js/faker';

import { FastifyInstance } from 'fastify';

import { DiscriminatedItem } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { AppDataSource } from '../../../plugins/datasource';
import { Account } from '../../account/entities/account';
import { ItemTestUtils } from '../../item/test/fixtures/items';
import { saveItemLoginSchema } from '../../itemLogin/test/index.test';
import { saveMember } from '../test/fixtures/members';
import { Member } from './member';

const memberRawRepository = AppDataSource.getRepository(Member);
const accountRawRepository = AppDataSource.getRepository(Account);
const testUtils = new ItemTestUtils();

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
  describe('fetching', () => {
    it('should not retrieve guest', async () => {
      const item = await testUtils.saveItem({});
      const { guest } = await saveItemLoginSchema({
        item: item as unknown as DiscriminatedItem,
        memberName: faker.internet.userName(),
      });
      expect(guest).toBeDefined();
      const member = await memberRawRepository.findOne({ where: { id: guest!.id } });
      expect(member).toBeNull();
    });
    it('fetching account should retrieve complete member', async () => {
      const member = await saveMember();
      const rawAccount = await accountRawRepository.findOne({ where: { id: member.id } });
      expect(rawAccount).toEqual(member);
    });
  });
});
