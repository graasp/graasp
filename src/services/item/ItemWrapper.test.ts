import { describe } from 'node:test';

import { FastifyInstance } from 'fastify';

import { ItemVisibilityType } from '@graasp/sdk';

import build, { MOCK_LOGGER, clearDatabase } from '../../../test/app';
import { saveMember } from '../member/test/fixtures/members';
import { ThumbnailService } from '../thumbnail/service';
import { ItemWrapper } from './ItemWrapper';
import { createTag, setItemPublic } from './plugins/itemVisibility/test/fixtures';
import { ItemThumbnailService } from './plugins/thumbnail/service';
import { ItemService } from './service';
import { ItemTestUtils } from './test/fixtures/items';

const testUtils = new ItemTestUtils();
const rawItemTagRepository = AppDataSource.getRepository(ItemVisibility);

describe('ItemWrapper', () => {
  let app: FastifyInstance;

  // datasource needs to be set
  beforeAll(async () => {
    ({ app } = await build());
  });
  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('createPackedItems', () => {
    it('Return the most restrictive visibilities for child item', async () => {
      const repositories = buildRepositories();
      const itemThumbnailService = new ItemThumbnailService(
        {} as unknown as ItemService,
        {} as unknown as ThumbnailService,
        MOCK_LOGGER,
      );
      jest.spyOn(itemThumbnailService, 'getUrlsByItems').mockImplementation(async () => ({}));

      const actor = await saveMember();
      const { item: parentItem } = await testUtils.saveItemAndMembership({});
      const { item } = await testUtils.saveItemAndMembership({ parentItem });

      const hiddenVisibility = await rawItemTagRepository.save(
        await createTag({ item, type: ItemVisibilityType.Hidden }),
      );
      const parentPublicTag = await setItemPublic(parentItem);
      await setItemPublic(item);

      const [packedItem] = await ItemWrapper.createPackedItems(
        actor,
        repositories,
        itemThumbnailService,
        [item],
      );
      expect(packedItem.public!.id).toEqual(parentPublicTag.id);
      // should return parent visibility, not item visibility
      expect(packedItem.hidden!.id).toEqual(hiddenVisibility.id);
    });
  });

  describe('packed', () => {
    it('Return the most restrictive visibility for child item', async () => {
      const parentItem = testUtils.createItem();
      const item = testUtils.createItem({ parentItem });

      const publicVisibility = await createTag({ item, type: ItemVisibilityType.Public });
      const parentHiddenTag = await createTag({
        item: parentItem,
        type: ItemVisibilityType.Hidden,
      });
      const hiddenVisibility = await createTag({ item, type: ItemVisibilityType.Hidden });
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
