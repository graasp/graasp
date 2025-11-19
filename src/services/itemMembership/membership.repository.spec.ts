import { describe, expect, it } from 'vitest';

import { PermissionLevel } from '@graasp/sdk';

import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { assertIsDefined } from '../../utils/assertions';
import { assertIsMemberForTest } from '../authentication';
import { ItemMembershipRepository } from './membership.repository';

const itemMembershipRepository = new ItemMembershipRepository();

describe('ItemMembership Repository', () => {
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
  describe('getForItem', () => {
    it('return direct memberships', async () => {
      const {
        items: [item],
        itemMemberships: [adminMembership, readMembership],
      } = await seedFromJson({
        items: [
          {
            memberships: [
              { account: 'actor', permission: PermissionLevel.Admin },
              { account: { name: 'bob' }, permission: PermissionLevel.Read },
            ],
          },
          // noise
          {
            memberships: [{ account: { name: 'cedric' }, permission: PermissionLevel.Admin }],
          },
        ],
      });

      const result = await itemMembershipRepository.getForItem(db, item);
      expect(result).toHaveLength(2);

      const adminM = result.find((m) => m.id === adminMembership.id);
      assertIsDefined(adminM);
      expect(adminM.item.path).toEqual(item.path);
      expect(adminM.permission).toEqual(PermissionLevel.Admin);

      const readM = result.find((m) => m.id === readMembership.id);
      assertIsDefined(readM);
      expect(readM.item.path).toEqual(item.path);
      expect(readM.permission).toEqual(PermissionLevel.Read);
    });
    it('return inherited memberships', async () => {
      const {
        items: [item, child],
        itemMemberships: [adminMembership, _readMembership, bobAdminMembership, writeMembership],
      } = await seedFromJson({
        items: [
          {
            memberships: [
              { account: 'actor', permission: PermissionLevel.Admin },
              { account: { name: 'bob' }, permission: PermissionLevel.Read },
            ],
            children: [
              {
                memberships: [
                  { account: { name: 'bob' }, permission: PermissionLevel.Admin },
                  { account: { name: 'alice' }, permission: PermissionLevel.Write },
                ],
              },
            ],
          },
          // noise
          {
            memberships: [{ account: { name: 'cedric' }, permission: PermissionLevel.Admin }],
          },
        ],
      });

      const result = await itemMembershipRepository.getForItem(db, child);
      expect(result).toHaveLength(3);

      // actor admin membership on parent
      const adminM = result.find(
        (m) => m.id === adminMembership.id && m.accountId === adminMembership.accountId,
      );
      assertIsDefined(adminM);
      expect(adminM.item.path).toEqual(item.path);
      expect(adminM.permission).toEqual(PermissionLevel.Admin);

      // bob admin membership on item
      const readM = result.find(
        (m) => m.id === bobAdminMembership.id && m.accountId === bobAdminMembership.accountId,
      );
      assertIsDefined(readM);
      expect(readM.item.path).toEqual(child.path);
      expect(readM.permission).toEqual(PermissionLevel.Admin);

      // alice write membership on item
      const writeM = result.find(
        (m) => m.id === writeMembership.id && m.accountId === writeMembership.accountId,
      );
      assertIsDefined(writeM);
      expect(writeM.item.path).toEqual(child.path);
      expect(writeM.permission).toEqual(PermissionLevel.Write);
    });
  });
});
