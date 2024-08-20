import { FastifyInstance } from 'fastify';

import { AccountType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { AppDataSource } from '../../../plugins/datasource';
import { ItemTestUtils } from '../../item/test/fixtures/items';
import { Member } from '../../member/entities/member';
import { saveMember } from '../../member/test/fixtures/members';
import { ItemMembership } from './ItemMembership';

const itemMembershipRawRepository = AppDataSource.getRepository(ItemMembership);
const itemTestUtils = new ItemTestUtils();

describe('ItemMembership', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    ({ app } = await build({ member: null }));
  });
  afterEach(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  describe('constraints', () => {
    it('should retrieve complete member', async () => {
      const member = await saveMember();
      const { item } = await itemTestUtils.saveItemAndMembership({ member });

      const rawItemMembership = await itemMembershipRawRepository.findOne({
        where: { item },
        relations: { item: true, account: true },
      });
      expect(rawItemMembership).not.toBeNull();
      expect(rawItemMembership!.item.id).toEqual(item.id);
      expect(rawItemMembership!.account.id).toEqual(member.id);
      expect(rawItemMembership!.account.type).toEqual(AccountType.Individual);

      expect((rawItemMembership!.account as Member).email).toEqual(member.email);
    });
  });
});
