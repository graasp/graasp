import { Readable } from 'node:stream';
import { In } from 'typeorm';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { FolderItemFactory, ItemGeolocation, ItemType, ItemVisibilityType } from '@graasp/sdk';

import build, { MOCK_LOGGER, clearDatabase, mockAuthenticate } from '../../../test/app.js';
import { seedFromJson } from '../../../test/mocks/seed.js';
import { MinimalMember } from '../../types.js';
import { assertIsDefined } from '../../utils/assertions.js';
import { assertIsMember } from '../authentication.js';
import * as authorization from '../authorization.js';
import { saveMember } from '../member/test/fixtures/members.js';
import { ThumbnailService } from '../thumbnail/service.js';
import { FolderItem } from './discrimination.js';
import { ItemVisibilityRepository } from './plugins/itemVisibility/repository.js';
import { MeiliSearchWrapper } from './plugins/publication/published/plugins/search/meilisearch.js';
import { ItemThumbnailService } from './plugins/thumbnail/service.js';
import { ItemService } from './service.js';

const testUtils = new ItemTestUtils();
const mockedThumbnailService = {
  copyFolder: jest.fn(),
  upload: jest.fn(async () => true),
} as unknown as jest.Mocked<ThumbnailService>;
const meilisearchWrapper = { indexOne: async () => {} } as unknown as MeiliSearchWrapper;
const itemService = new ItemService(
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
      jest.spyOn(repositories.itemRepository, 'getOneOrThrow').mockResolvedValue(item);
      jest
        .spyOn(authorization, 'validatePermission')
        .mockResolvedValue({ itemMembership: null, visibilities: [] });

      const result = await itemService.get(actor, repositories, item.id);
      expect(result).toEqual(item);
    });
    it('throw if item does not exists', async () => {
      const actor = { id: v4() };
      const item = FolderItemFactory() as unknown as FolderItem;
      jest.spyOn(repositories.itemRepository, 'getOneOrThrow').mockRejectedValue(new Error());

      await expect(() => itemService.get(actor, repositories, item.id)).rejects.toThrow();
    });
    it('throw if validation does not pass', async () => {
      const actor = { id: v4() } as MinimalMember;
      const item = FolderItemFactory() as unknown as FolderItem;
      jest.spyOn(repositories.itemRepository, 'getOneOrThrow').mockResolvedValue(item);
      jest.spyOn(authorization, 'validatePermission').mockRejectedValue(new Error());

      await expect(() => itemService.get(actor, repositories, item.id)).rejects.toThrow();
    });
  });
  describe('Post', () => {
    beforeEach(() => {
      jest
        .spyOn(authorization, 'validatePermission')
        .mockResolvedValue({ itemMembership: null, visibilities: [] });
    });

    it('Post with parent assigns correct order', async () => {
      const actor = await saveMember();
      const repositories = buildRepositories();
      const parentItem = await itemService.post(actor, repositories, {
        item: { name: 'parentItem', type: ItemType.FOLDER },
      });

      const item1Name = 'item1';
      await itemService.post(actor, repositories, {
        item: { name: item1Name, type: ItemType.FOLDER },
        parentId: parentItem.id,
      });
      const item2Name = 'item2';
      await itemService.post(actor, repositories, {
        item: { name: item2Name, type: ItemType.FOLDER },
        parentId: parentItem.id,
      });

      const itemsInDB = await testUtils.itemRepository.getChildren(
        actor,
        parentItem,
        { ordered: true },
        { withOrder: true },
      );

      // the items should follow the LIFO ordering
      expect(itemsInDB[0].name).toEqual(item2Name);
      expect(itemsInDB[1].name).toEqual(item1Name);
    });
    it('Post with previous item ID assigns correct order', async () => {
      const actor = await saveMember();
      const repositories = buildRepositories();
      const parentItem = await itemService.post(actor, repositories, {
        item: { name: 'parentItem', type: ItemType.FOLDER },
      });

      const item1Name = 'item1';
      const item1 = await itemService.post(actor, repositories, {
        item: { name: item1Name, type: ItemType.FOLDER },
        parentId: parentItem.id,
      });
      const item2Name = 'item2';
      await itemService.post(actor, repositories, {
        item: { name: item2Name, type: ItemType.FOLDER },
        parentId: parentItem.id,
        previousItemId: item1.id,
      });

      const itemsInDB = await testUtils.itemRepository.getChildren(
        actor,
        parentItem,
        { ordered: true },
        { withOrder: true },
      );

      // the item order must respect the previousItemId
      expect(itemsInDB[0].name).toEqual(item1Name);
      expect(itemsInDB[1].name).toEqual(item2Name);
    });
  });
  describe('Post many', () => {
    beforeEach(() => {
      jest
        .spyOn(authorization, 'validatePermission')
        .mockResolvedValue({ itemMembership: null, visibilities: [] });
    });

    it('Respects the input item array order', async () => {
      const actor = await saveMember();
      const repositories = buildRepositories();
      const {
        items: [parentItem],
      } = await seedFromJson({
        items: [{ name: 'parentItem', type: ItemType.FOLDER }],
      });
      const items: { item: Item }[] = [];
      const itemNames: string[] = [];
      for (let i = 0; i < 15; i++) {
        const name = `item${i}`;
        items.push({ item: { name: `item${i}`, type: ItemType.FOLDER } as Item });
        itemNames.push(name);
      }

      await itemService.postMany(actor, repositories, {
        items,
        parentId: parentItem.id,
      });

      const itemsInDB = await testUtils.itemRepository.getChildren(
        actor,
        parentItem,
        { ordered: true },
        { withOrder: true },
      );
      const namesInDB = itemsInDB.map((i) => i.name);

      expect(namesInDB).toEqual(itemNames);
    });
    it('Uploads the thumbnails', async () => {
      const actor = await saveMember();
      const repositories = buildRepositories();
      const {
        items: [parentItem],
      } = await seedFromJson({
        items: [{ name: 'parentItem', type: ItemType.FOLDER }],
      });

      const items: { item: Item; thumbnail?: Readable }[] = [];

      for (let i = 0; i < 15; i++) {
        items.push({
          item: { name: `item${i}`, type: ItemType.FOLDER } as Item,
          thumbnail: {} as Readable,
        });
      }

      const newItems = await itemService.postMany(actor, repositories, {
        items,
        parentId: parentItem.id,
      });

      const itemsInDB = await testUtils.rawItemRepository.find({
        where: { id: In(newItems.map((i) => i.id)) },
      });

      expect(itemsInDB.every((i) => i.settings.hasThumbnail === true)).toBeTruthy();
    });
    it('Saves the geolocations', async () => {
      const actor = await saveMember();
      const repositories = buildRepositories();
      const geoMock = jest.spyOn(repositories.itemGeolocationRepository, 'put');
      const {
        items: [parentItem],
      } = await seedFromJson({
        items: [{ name: 'parentItem', type: ItemType.FOLDER }],
      });

      const items: { item: Item; geolocation?: ItemGeolocation }[] = [];

      for (let i = 0; i < 15; i++) {
        items.push({
          item: { name: `item${i}`, type: ItemType.FOLDER } as Item,
          geolocation: { lat: 35.652832, lng: 139.839478 } as ItemGeolocation,
        });
      }

      await itemService.postMany(actor, repositories, {
        items,
        parentId: parentItem.id,
      });

      expect(geoMock).toHaveBeenCalledTimes(15);
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
      const visibilityCopyAllMock = jest.spyOn(ItemVisibilityRepository.prototype, 'copyAll');
      jest
        .spyOn(authorization, 'validatePermission')
        .mockResolvedValue({ itemMembership, visibilities: [iv] });

      await itemService.copy(actor, buildRepositories(), item.id);
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
      await itemService.copy(actor, buildRepositories(), item.id);
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
      await itemService.copy(actor, buildRepositories(), item.id);
      expect(mockedThumbnailService.copyFolder).not.toHaveBeenCalled();
    });

    it('Index newly copied items if copied in a published item', async () => {
      const indexMock = jest.spyOn(meilisearchWrapper, 'indexOne');
      const actor = await saveMember();

      const { item: unpublishedItem, itemMembership } = await testUtils.saveItemAndMembership({
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
      await app.db.getRepository(ItemPublished).save({ item: publishedFolder, creator: actor });

      jest
        .spyOn(authorization, 'validatePermission')
        .mockResolvedValue({ itemMembership, visibilities: [iv] });

      await itemService.copy(
        actor,

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

      // WHEN
      jest.spyOn(repositories.itemRepository, 'checkHierarchyDepth').mockImplementation(() => {
        throw new Error('is too deep');
      });

      // SHOULD
      await expect(() =>
        itemService.post(actor, repositories, {
          parentId: item.id,
          item: { name: 'item', type: ItemType.FOLDER },
        }),
      ).rejects.toThrow();
    });
  });
});
