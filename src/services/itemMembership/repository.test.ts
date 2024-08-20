import { FastifyInstance } from 'fastify';

import { PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../test/app';
import { buildRepositories } from '../../utils/repositories';
import { Item } from '../item/entities/Item';
import { ItemTestUtils } from '../item/test/fixtures/items';
import { Member, isMember } from '../member/entities/member';
import { saveMember } from '../member/test/fixtures/members';
import { ItemMembership } from './entities/ItemMembership';
import { ItemMembershipRepository } from './repository';

const testUtils = new ItemTestUtils();

function crossArrayCheck(
  itemArray: Item[],
  itemMembershipArray: ItemMembership[],
  crossIdMap: { [key in string]: string[] },
): boolean {
  return itemMembershipArray.every((m) => itemArray.some((i) => crossIdMap[i.path].includes(m.id)));
}

describe('ItemMembership Repository', () => {
  let app: FastifyInstance;
  let item: Item;
  let creator: Member;
  let itemMembershipRepository: typeof ItemMembershipRepository;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
    ({ itemMembershipRepository } = buildRepositories());
  });

  beforeEach(async () => {
    creator = await saveMember();
    item = await testUtils.saveItem({ actor: creator });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
  });

  afterAll(async () => {
    app.close();
  });

  describe('getAllWithPermission', () => {
    it('should return empty array when there is no corresponding permission', async () => {
      const result = await itemMembershipRepository.getByItemPathAndPermission(
        item.path,
        PermissionLevel.Admin,
      );
      expect(result).toEqual([]);
    });
    it('should return all from the corresponding item', async () => {
      const preset = {
        [PermissionLevel.Admin]: 3,
        [PermissionLevel.Read]: 6,
        [PermissionLevel.Write]: 4,
      };
      for (const entry in preset) {
        const permission = entry as PermissionLevel;
        for (let i = 0; i < preset[permission]; i++) {
          const temporaryMember = await saveMember();
          await testUtils.saveMembership({ item, permission, account: temporaryMember });
        }
      }

      const result = await itemMembershipRepository.getByItemPathAndPermission(
        item.path,
        PermissionLevel.Admin,
      );
      expect(result).toHaveLength(preset[PermissionLevel.Admin]);
      expect(result.every((m) => m.permission === PermissionLevel.Admin)).toBe(true);
      expect(
        result.every((m) => {
          const account = m.account;
          if (isMember(account)) {
            return Boolean(account.email);
          }
          return false;
        }),
      ).toBe(true);
    });
    it('should return all from all ancestors items', async () => {
      const parentItem = await testUtils.saveItem({ actor: creator, parentItem: item });
      const targetItem = await testUtils.saveItem({ actor: creator, parentItem });
      const siblingItem = await testUtils.saveItem({ actor: creator, parentItem });
      const childItem = await testUtils.saveItem({ actor: creator, parentItem: targetItem });
      const uncleItem = await testUtils.saveItem({ actor: creator, parentItem: item });

      const items = [item, parentItem, targetItem, siblingItem, childItem, uncleItem];

      const preset = {
        [PermissionLevel.Admin]: 3,
        [PermissionLevel.Read]: 6,
        [PermissionLevel.Write]: 4,
      };

      const memberships: Record<string, string[]> = Object.fromEntries(
        items.map((i) => [i.path, []]),
      );
      for (const entry in preset) {
        const permission = entry as PermissionLevel;
        for (let i = 0; i < preset[permission]; i++) {
          for (const item of items) {
            const temporaryMember = await saveMember();
            const membership = await testUtils.saveMembership({
              item,
              permission,
              account: temporaryMember,
            });
            memberships[membership.item.path] = [
              ...memberships[membership.item.path],
              membership.id,
            ];
          }
        }
      }

      const result = await itemMembershipRepository.getByItemPathAndPermission(
        targetItem.path,
        PermissionLevel.Read,
      );

      const expectedItems = [targetItem, parentItem, item];

      expect(result).toHaveLength(preset[PermissionLevel.Read] * expectedItems.length);
      expect(result.every((m) => m.permission === PermissionLevel.Read)).toBe(true);
      expect(
        result.every((m) => {
          const account = m.account;
          if (isMember(account)) {
            return Boolean(account.email);
          }
          return false;
        }),
      ).toBe(true);
      expect(crossArrayCheck(expectedItems, result, memberships)).toBe(true);
    });
  });
});
