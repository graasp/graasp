import { PermissionLevel } from '@graasp/sdk';

import { clearDatabase } from '../../../test/app';
import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { ItemMembershipRepository } from './membership.repository';

const itemMembershipRepository = new ItemMembershipRepository();

describe('ItemMembership Repository', () => {
  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(db);
  });

  describe('getAdminsForItem', () => {
    it('should return empty array when there is no corresponding permission', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });
      const result = await itemMembershipRepository.getAdminsForItem(db, item.path);
      expect(result).toEqual([]);
    });
    it('should return all from the corresponding item', async () => {
      const {
        items: [item],
        members: [bob, cedric],
      } = await seedFromJson({
        items: [
          {
            memberships: [
              { account: { name: 'bob' }, permission: PermissionLevel.Admin },
              { account: { name: 'cedric' }, permission: PermissionLevel.Admin },
              { account: { name: 'anna' }, permission: PermissionLevel.Write },
              { account: { name: 'david' }, permission: PermissionLevel.Read },
            ],
          },
        ],
      });

      const result = await itemMembershipRepository.getAdminsForItem(db, item.path);
      expect(result).toHaveLength(2);
      const admins = result.map((m) => m.id);
      expect(admins).toContain(bob.id);
      expect(admins).toContain(cedric.id);
    });
    it('should return all from the ancestors', async () => {
      const {
        items: [_parent, child],
        members: [bob, cedric, _c, _d, evian, fabrice],
      } = await seedFromJson({
        items: [
          {
            memberships: [
              { account: { name: 'bob' }, permission: PermissionLevel.Admin },
              { account: { name: 'cedric' }, permission: PermissionLevel.Admin },
              { account: { name: 'anna' }, permission: PermissionLevel.Write },
              { account: { name: 'david' }, permission: PermissionLevel.Read },
            ],
            children: [
              {
                memberships: [
                  { account: { name: 'evian' }, permission: PermissionLevel.Admin },
                  { account: { name: 'fabrice' }, permission: PermissionLevel.Admin },
                  { account: { name: 'george' }, permission: PermissionLevel.Write },
                  { account: { name: 'helene' }, permission: PermissionLevel.Read },
                ],
              },
            ],
          },
        ],
      });

      const result = await itemMembershipRepository.getAdminsForItem(db, child.path);
      expect(result).toHaveLength(4);
      const admins = result.map((m) => m.id);
      expect(admins).toContain(bob.id);
      expect(admins).toContain(cedric.id);
      expect(admins).toContain(evian.id);
      expect(admins).toContain(fabrice.id);
    });
  });
});
