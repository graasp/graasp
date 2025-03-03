import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { FolderItemFactory, ItemType, ItemVisibilityType } from '@graasp/sdk';

import build, {
  MOCK_LOGGER,
  clearDatabase,
  mockAuthenticate,
} from '../../../test/app';
import { seedFromJson } from '../../../test/mocks/seed';
import { assertIsDefined } from '../../utils/assertions';
import { buildRepositories } from '../../utils/repositories';
import * as authorization from '../authorization';
import { Actor, assertIsMember } from '../member/entities/member';
import { saveMember } from '../member/test/fixtures/members';
import { ThumbnailService } from '../thumbnail/service';
import { FolderItem } from './entities/Item';
import { ItemVisibility } from './plugins/itemVisibility/ItemVisibility';
import { ItemVisibilityRepository } from './plugins/itemVisibility/repository';
import { ItemPublished } from './plugins/publication/published/entities/itemPublished';
import { MeiliSearchWrapper } from './plugins/publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from './plugins/thumbnail/service';
import { ItemService } from './service';
import { ItemTestUtils } from './test/fixtures/items';

const testUtils = new ItemTestUtils();
const mockedThumbnailService = {
  copyFolder: jest.fn(),
} as unknown as jest.Mocked<ThumbnailService>;
const meilisearchWrapper = {
  indexOne: async () => {},
} as unknown as MeiliSearchWrapper;
const service = new ItemService(
  mockedThumbnailService,
  {} as ItemThumbnailService,
  meilisearchWrapper,
  MOCK_LOGGER,
);

describe('Item Service', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });
  afterEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('get', () => {
    it('return item if exists and pass validation', async () => {
      const actor = { id: v4() } as Actor;
      const item = FolderItemFactory() as unknown as FolderItem;
      const repositories = buildRepositories();
      jest
        .spyOn(repositories.itemRepository, 'getOneOrThrow')
        .mockResolvedValue(item);
      jest
        .spyOn(authorization, 'validatePermission')
        .mockResolvedValue({ itemMembership: null, visibilities: [] });

      const result = await service.get(actor, repositories, item.id);
      expect(result).toEqual(item);
    });
    it('throw if item does not exists', async () => {
      const actor = { id: v4() } as Actor;
      const item = FolderItemFactory() as unknown as FolderItem;
      const repositories = buildRepositories();
      jest
        .spyOn(repositories.itemRepository, 'getOneOrThrow')
        .mockRejectedValue(new Error());

      await expect(() =>
        service.get(actor, repositories, item.id),
      ).rejects.toThrow();
    });
    it('throw if validation does not pass', async () => {
      const actor = { id: v4() } as Actor;
      const item = FolderItemFactory() as unknown as FolderItem;
      const repositories = buildRepositories();
      jest
        .spyOn(repositories.itemRepository, 'getOneOrThrow')
        .mockResolvedValue(item);
      jest
        .spyOn(authorization, 'validatePermission')
        .mockRejectedValue(new Error());

      await expect(() =>
        service.get(actor, repositories, item.id),
      ).rejects.toThrow();
    });
  });
  describe('Copy', () => {
    it('Should copy hidden visiblity on item copy', async () => {
      const actor = await saveMember();
      const { item, itemMembership } = await testUtils.saveItemAndMembership({
        member: actor,
        item: { settings: { hasThumbnail: true } },
      });
      const iv = await app.db
        .getRepository(ItemVisibility)
        .save({ item, type: ItemVisibilityType.Hidden });
      const visibilityCopyAllMock = jest.spyOn(
        ItemVisibilityRepository.prototype,
        'copyAll',
      );
      jest
        .spyOn(authorization, 'validatePermission')
        .mockResolvedValue({ itemMembership, visibilities: [iv] });

      await service.copy(actor, buildRepositories(), item.id);
      expect(visibilityCopyAllMock).toHaveBeenCalled();
    });
    it('Should copy thumbnails on item copy if original has thumbnails', async () => {
      const actor = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        item: { settings: { hasThumbnail: true } },
      });
      jest
        .spyOn(authorization, 'validatePermission')
        .mockResolvedValue({ itemMembership: null, visibilities: [] });
      await service.copy(actor, buildRepositories(), item.id);
      expect(mockedThumbnailService.copyFolder).toHaveBeenCalled();
    });
    it('Should not copy thumbnails on item copy if original has no thumbnails', async () => {
      const actor = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        item: { settings: { hasThumbnail: false } },
      });
      jest
        .spyOn(authorization, 'validatePermission')
        .mockResolvedValue({ itemMembership: null, visibilities: [] });
      await service.copy(buildRepositories(), item.id);
      expect(mockedThumbnailService.copyFolder).not.toHaveBeenCalled();
    });

    it('Index newly copied items if copied in a published item', async () => {
      const indexMock = jest.spyOn(meilisearchWrapper, 'indexOne');
      const actor = await saveMember();

      const { item: unpublishedItem, itemMembership } =
        await testUtils.saveItemAndMembership({
          member: actor,
          item: { name: 'unpublishedItem' },
        });

      const { item: publishedFolder } = await testUtils.saveItemAndMembership({
        member: actor,
      });
      const iv = await app.db.getRepository(ItemVisibility).save({
        item: publishedFolder,
        type: ItemVisibilityType.Public,
        creator: actor,
      });
      await app.db
        .getRepository(ItemPublished)
        .save({ item: publishedFolder, creator: actor });

      jest
        .spyOn(authorization, 'validatePermission')
        .mockResolvedValue({ itemMembership, visibilities: [iv] });

      await service.copy(
        actor,
        buildRepositories(),
        unpublishedItem.id,
        publishedFolder as FolderItem,
      );

      expect(indexMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('post', () => {
    it('throw if reached maximum tree depth', async () => {
      // GIVEN
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor' }] }],
      });
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);
      const repositories = buildRepositories();

      // WHEN
      jest
        .spyOn(repositories.itemRepository, 'checkHierarchyDepth')
        .mockImplementation(() => {
          throw new Error('is too deep');
        });

      // SHOULD
      await expect(() =>
        service.post(actor, repositories, {
          parentId: item.id,
          item: { name: 'item', type: ItemType.FOLDER },
        }),
      ).rejects.toThrow();
    });
  });
});
