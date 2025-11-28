import { describe } from 'node:test';
import { expect, it, vi } from 'vitest';

import { ItemVisibilityType } from '@graasp/sdk';

import { ItemFactory } from '../../../test/factories/item.factory';
import { ItemVisibilityFactory } from '../../../test/factories/itemVisibility.factory';
import { seedFromJson } from '../../../test/mocks/seed';
import type { DBConnection } from '../../drizzle/db';
import { assertIsDefined } from '../../utils/assertions';
import { assertIsMemberForTest } from '../authentication';
import { ItemMembershipRepository } from '../itemMembership/membership.repository';
import { ItemWrapper, ItemWrapperService } from './ItemWrapper';
import { ItemVisibilityRepository } from './plugins/itemVisibility/itemVisibility.repository';
import { ItemThumbnailService } from './plugins/thumbnail/itemThumbnail.service';

describe('ItemWrapper', () => {
  describe('packed', () => {
    it('Return the most restrictive visibility for child item', async () => {
      const parentItem = ItemFactory({});
      const item = ItemFactory({ parentPath: parentItem.path });

      const publicVisibility = ItemVisibilityFactory({
        item,
        type: ItemVisibilityType.Public,
      });
      const parentHiddenTag = ItemVisibilityFactory({
        item,
        type: ItemVisibilityType.Hidden,
      });
      const hiddenVisibility = await ItemVisibilityFactory({
        item,
        type: ItemVisibilityType.Hidden,
      });
      // unordered visibilities
      const visibilities = [hiddenVisibility, publicVisibility, parentHiddenTag];
      const itemWrapper = new ItemWrapper(item, undefined, visibilities);

      const packedItem = itemWrapper.packed();
      expect(packedItem.public!.id).toEqual(publicVisibility.id);
      // should return parent visibility, not item visibility
      expect(packedItem.hidden!.id).toEqual(parentHiddenTag.id);
    });
  });
});

describe('ItemWrapperService', () => {
  describe('createPackedItems', () => {
    it('Return the most restrictive visibilities for child item', async () => {
      const MOCK_DB = {} as DBConnection;
      const { actor, items, itemMemberships, itemVisibilities } = await seedFromJson({
        items: [
          {
            isPublic: true,
            memberships: [{ account: 'actor' }],
          },
          {
            isHidden: true,
            memberships: [{ account: 'actor' }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const itemVisibilityRepository = {
        getForManyItems: vi.fn(),
      } as unknown as ItemVisibilityRepository;
      vi.spyOn(itemVisibilityRepository, 'getForManyItems').mockImplementation(async () => ({
        data: {
          [items[0].id]: [itemVisibilities[0]],
          [items[1].id]: [itemVisibilities[1]],
        } as any,
        errors: [],
      }));

      const resultOfMemberships = {
        data: { [items[0].id]: [itemMemberships[0]], [items[1].id]: [itemMemberships[1]] },
        errors: [],
      } as any;
      const itemMembershipRepository = {
        getForManyItems: vi.fn(),
      } as unknown as ItemMembershipRepository;
      vi.spyOn(itemMembershipRepository, 'getForManyItems').mockImplementation(
        async () => resultOfMemberships,
      );

      const itemThumbnailService = { getUrlsByItems: vi.fn() } as unknown as ItemThumbnailService;
      vi.spyOn(itemThumbnailService, 'getUrlsByItems').mockImplementation(async () => ({}));

      const packedItems = await new ItemWrapperService(
        itemVisibilityRepository,
        itemMembershipRepository,
        itemThumbnailService,
      ).createPackedItems(
        MOCK_DB,
        items.map((i) => ({ ...i, creator: actor })),
        resultOfMemberships,
      );

      expect(packedItems[0].public!.id).toEqual(itemVisibilities[0].id);
      // should return parent visibility, not item visibility
      expect(packedItems[1].hidden!.id).toEqual(itemVisibilities[1].id);
    });
  });
});
