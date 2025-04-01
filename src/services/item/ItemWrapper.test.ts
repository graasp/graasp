import { describe } from 'node:test';

import { FastifyInstance } from 'fastify';

import { ItemVisibilityType } from '@graasp/sdk';

import build, { MOCK_LOGGER, clearDatabase } from '../../../test/app';
import { ItemFactory } from '../../../test/factories/item.factory';
import { ItemVisibilityFactory } from '../../../test/factories/itemVisibility.factory';
import { ThumbnailService } from '../thumbnail/thumbnail.service';
import { ItemWrapper, ItemWrapperService } from './ItemWrapper';
import { ItemService } from './item.service';
import { ItemThumbnailService } from './plugins/thumbnail/itemThumbnail.service';

// const itemThumbnailService = new ItemThumbnailService(
//   {} as unknown as ItemService,
//   {} as unknown as ThumbnailService,
//   MOCK_LOGGER,
// );
// const itemPublishedRepository = {} as ItemPublishedRepository;

// const itemWrapperService = new ItemWrapperService(
//   itemVisibilityRepository,
//   itemMembershipRepository,
//   itemThumbnailService,
// );

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

// describe('ItemWrapperService', () => {
//   describe('createPackedItems', () => {
//     it('Return the most restrictive visibilities for child item', async () => {
//       const itemThumbnailService = new ItemThumbnailService(
//         {} as unknown as ItemService,
//         {} as unknown as ThumbnailService,
//         MOCK_LOGGER,
//       );
//       jest.spyOn(itemThumbnailService, 'getUrlsByItems').mockImplementation(async () => ({}));

//       const actor = await saveMember();
//       const { item: parentItem } = await testUtils.saveItemAndMembership({});
//       const { item } = await testUtils.saveItemAndMembership({ parentItem });

//       const hiddenVisibility = await rawItemTagRepository.save(
//         await createTag({ item, type: ItemVisibilityType.Hidden }),
//       );
//       const parentPublicTag = await setItemPublic(parentItem);
//       await setItemPublic(item);

//       const [packedItem] = await ItemWrapper.createPackedItems(
//         actor,
//         repositories,
//         itemThumbnailService,
//         [item],
//       );
//       expect(packedItem.public!.id).toEqual(parentPublicTag.id);
//       // should return parent visibility, not item visibility
//       expect(packedItem.hidden!.id).toEqual(hiddenVisibility.id);
//     });
//   });
// });
