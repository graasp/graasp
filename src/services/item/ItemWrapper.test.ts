import { describe } from 'node:test';

import { FastifyInstance } from 'fastify';

import { ItemTagType } from '@graasp/sdk';

import build, { MOCK_LOGGER, clearDatabase } from '../../../test/app';
import { AppDataSource } from '../../plugins/datasource';
import { buildRepositories } from '../../utils/repositories';
import { saveMember } from '../member/test/fixtures/members';
import { ThumbnailService } from '../thumbnail/service';
import { ItemWrapper } from './ItemWrapper';
import { ItemTag } from './plugins/itemTag/ItemTag';
import { createTag, setItemPublic } from './plugins/itemTag/test/fixtures';
import { ItemThumbnailService } from './plugins/thumbnail/service';
import { ItemService } from './service';
import { ItemTestUtils } from './test/fixtures/items';

const testUtils = new ItemTestUtils();
const rawItemTagRepository = AppDataSource.getRepository(ItemTag);

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
    it('Return highest tags for child item', async () => {
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

      const hiddenTag = await rawItemTagRepository.save(
        await createTag({ item, type: ItemTagType.Hidden }),
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
      // should return parent tag, not item tag
      expect(packedItem.hidden!.id).toEqual(hiddenTag.id);
    });
  });

  describe('packed', () => {
    it('Return highest tags for child item', async () => {
      const parentItem = testUtils.createItem();
      const item = testUtils.createItem({ parentItem });

      const publicTag = await createTag({ item, type: ItemTagType.Public });
      const parentHiddenTag = await createTag({ item: parentItem, type: ItemTagType.Hidden });
      const hiddenTag = await createTag({ item, type: ItemTagType.Hidden });
      // unordered tags
      const tags = [hiddenTag, publicTag, parentHiddenTag];
      const itemWrapper = new ItemWrapper(item, undefined, tags);

      const packedItem = itemWrapper.packed();
      expect(packedItem.public!.id).toEqual(publicTag.id);
      // should return parent tag, not item tag
      expect(packedItem.hidden!.id).toEqual(parentHiddenTag.id);
    });
  });
});
