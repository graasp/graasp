import { PermissionLevel } from '@graasp/sdk';

import { clearDatabase } from '../../../test/app';
import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { assertIsDefined } from '../../utils/assertions';
import { assertIsMemberForTest } from '../authentication';
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

  describe('getAccessibleItemNames', () => {
    it('return read, write and admin items with common name', async () => {
      const commonStart = 'commonStart';
      const {
        items: [i1, i2, i3, i4],
        actor,
      } = await seedFromJson({
        items: [
          {
            name: 'commonStart 1',
            memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
          },
          {
            name: 'commonStart 2',
            memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
          },
          {
            name: 'commonStart 3',
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
          },
          // noise
          {
            name: 'commonStart 4',
            memberships: [{ account: { name: 'bob' }, permission: PermissionLevel.Admin }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const names = await itemMembershipRepository.getAccessibleItemNames(db, actor, {
        startWith: commonStart,
      });
      expect(names).toContain(i1.name);
      expect(names).toContain(i2.name);
      expect(names).toContain(i3.name);
      expect(names).not.toContain(i4.name);
    });
    it('return accessible child with permission', async () => {
      const commonStart = 'commonStart';
      const {
        items: [i1, i2, i3],
        actor,
      } = await seedFromJson({
        items: [
          {
            name: 'commonStart 1',
            children: [
              {
                name: 'commonStart 2',
                memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              },
              // noise
              {
                name: 'commonStart 4',
                memberships: [{ account: { name: 'bob' }, permission: PermissionLevel.Admin }],
              },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const names = await itemMembershipRepository.getAccessibleItemNames(db, actor, {
        startWith: commonStart,
      });
      expect(names).toContain(i2.name);
      expect(names).not.toContain(i1.name);
      expect(names).not.toContain(i3.name);
    });
    it('return only accessible parent without child', async () => {
      const commonStart = 'commonStart';
      const {
        items: [i1, i2, i3],
        actor,
      } = await seedFromJson({
        items: [
          {
            name: 'commonStart 1',
            memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
            children: [
              // noise
              {
                name: 'commonStart 2',
                memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              },
              // noise
              {
                name: 'commonStart 3',
                memberships: [{ account: { name: 'bob' }, permission: PermissionLevel.Admin }],
              },
            ],
          },
          // noise
          {
            name: 'commonStart 4',
            memberships: [{ account: { name: 'bob' }, permission: PermissionLevel.Admin }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const names = await itemMembershipRepository.getAccessibleItemNames(db, actor, {
        startWith: commonStart,
      });
      expect(names).toContain(i1.name);
      expect(names).not.toContain(i2.name);
      expect(names).not.toContain(i3.name);
    });
  });
});
