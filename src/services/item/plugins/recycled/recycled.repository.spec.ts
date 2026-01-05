import { subMonths } from 'date-fns';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PermissionLevel } from '@graasp/sdk';

import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { recycledItemDatasTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { MemberCannotAdminItem } from '../../../../utils/errors';
import { assertIsMemberForTest } from '../../../authentication';
import { RecycledItemDataRepository } from './recycled.repository';

const recycledRepository = new RecycledItemDataRepository();

describe('RecycledItemDataRepository', () => {
  describe('assertAdminAccessForItemIds', () => {
    it('resolve for item with admin permission', async () => {
      const { items, actor } = await seedFromJson({
        items: [{ memberships: [{ permission: PermissionLevel.Admin, account: 'actor' }] }],
      });
      assertIsDefined(actor);

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      await expect(
        recycledRepository.assertAdminAccessForItemIds(
          db,
          actor.id,
          items.map((i) => i.id),
        ),
      ).resolves;
    });

    it('resolve for item with parent with admin permission', async () => {
      const {
        items: [_parent, child],
        actor,
      } = await seedFromJson({
        items: [
          {
            memberships: [{ permission: PermissionLevel.Admin, account: 'actor' }],
            children: [{}],
          },
        ],
      });
      assertIsDefined(actor);

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      await expect(recycledRepository.assertAdminAccessForItemIds(db, actor.id, [child.id]))
        .resolves;
    });

    it('reject for item with write permission', async () => {
      const { items, actor } = await seedFromJson({
        items: [{ memberships: [{ permission: PermissionLevel.Write, account: 'actor' }] }],
      });
      assertIsDefined(actor);

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      await expect(
        recycledRepository.assertAdminAccessForItemIds(
          db,
          actor.id,
          items.map((i) => i.id),
        ),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);
    });

    it('reject for one item with write permission', async () => {
      const { items, actor } = await seedFromJson({
        items: [
          { memberships: [{ permission: PermissionLevel.Admin, account: 'actor' }] },
          { memberships: [{ permission: PermissionLevel.Write, account: 'actor' }] },
        ],
      });
      assertIsDefined(actor);

      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      await expect(
        recycledRepository.assertAdminAccessForItemIds(
          db,
          actor.id,
          items.map((i) => i.id),
        ),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);
    });
  });
  describe('getOwnRecycledItems', () => {
    it('return top most recycled items', async () => {
      const {
        items: [deletedParent, deletedParentChild],
        actor,
      } = await seedFromJson({
        items: [
          // should return top parent, but not the child
          {
            memberships: [{ permission: PermissionLevel.Admin, account: 'actor' }],
            children: [{}],
            isDeleted: true,
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const result = (
        await recycledRepository.getOwnRecycledItems(db, actor, { page: 1, pageSize: 100 })
      ).data.map(({ id }) => id);
      expect(result).toContain(deletedParent.id);
      expect(result).not.toContain(deletedParentChild.id);
    });
    it('do not return child of deleted items', async () => {
      const {
        items: [parent, adminChild],
        actor,
      } = await seedFromJson({
        items: [
          {
            children: [
              {
                memberships: [{ permission: PermissionLevel.Admin, account: 'actor' }],
              },
            ],
            isDeleted: true,
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const result = (
        await recycledRepository.getOwnRecycledItems(db, actor, { page: 1, pageSize: 100 })
      ).data.map(({ id }) => id);
      expect(result).not.toContain(parent.id);
      expect(result).not.toContain(adminChild.id);
    });
    it('return deleted child of admin item', async () => {
      const {
        items: [adminParent, deletedChild],
        actor,
      } = await seedFromJson({
        items: [
          // should return the deleted child, permission on the parent
          {
            memberships: [{ permission: PermissionLevel.Admin, account: 'actor' }],
            children: [
              {
                isDeleted: true,
              },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const result = (
        await recycledRepository.getOwnRecycledItems(db, actor, { page: 1, pageSize: 100 })
      ).data.map(({ id }) => id);

      expect(result).not.toContain(adminParent.id);
      expect(result).toContain(deletedChild.id);
    });
    it('do not return recycled items without access', async () => {
      const {
        items: [readItem],
        actor,
      } = await seedFromJson({
        items: [
          {
            memberships: [{ permission: PermissionLevel.Read, account: 'actor' }],
            isDeleted: true,
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const result = (
        await recycledRepository.getOwnRecycledItems(db, actor, { page: 1, pageSize: 100 })
      ).data.map(({ id }) => id);
      expect(result).not.toContain(readItem.id);
    });
    it('do not return non-recycled items', async () => {
      const {
        items: [nonRecycledItem],
        actor,
      } = await seedFromJson({
        items: [
          {
            memberships: [{ permission: PermissionLevel.Admin, account: 'actor' }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const result = (
        await recycledRepository.getOwnRecycledItems(db, actor, { page: 1, pageSize: 100 })
      ).data.map(({ id }) => id);
      expect(result).not.toContain(nonRecycledItem.id);
    });

    it('do not return items deleted before 3 months ago', async () => {
      const {
        items: [oldDeletedItem, validItem],
        actor,
      } = await seedFromJson({
        items: [
          {
            memberships: [{ permission: PermissionLevel.Admin, account: 'actor' }],
            isDeleted: true,
          },
          {
            memberships: [{ permission: PermissionLevel.Admin, account: 'actor' }],
            isDeleted: true,
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      // set recycled createdAt to older than 3 months
      const oldDate = subMonths(new Date(), 4);
      await db
        .update(recycledItemDatasTable)
        .set({ createdAt: oldDate.toISOString() })
        .where(eq(recycledItemDatasTable.itemPath, oldDeletedItem.path));

      const result = (
        await recycledRepository.getOwnRecycledItems(db, actor, { page: 1, pageSize: 100 })
      ).data.map(({ id }) => id);

      expect(result).not.toContain(oldDeletedItem.id);
      expect(result).toContain(validItem.id);
    });
  });
});
