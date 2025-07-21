import { PermissionLevel } from '@graasp/sdk';

import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { assertIsDefined } from '../../../../utils/assertions';
import { MemberCannotAdminItem } from '../../../../utils/errors';
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
});
