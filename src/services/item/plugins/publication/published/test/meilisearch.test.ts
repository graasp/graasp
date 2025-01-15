import { expect, jest } from '@jest/globals';
import {
  EnqueuedTask,
  Index,
  MeiliSearch,
  MultiSearchParams,
  MultiSearchResponse,
  Task,
  TaskStatus,
} from 'meilisearch';
import { DataSource, EntityManager } from 'typeorm';
import { v4 } from 'uuid';

import {
  IndexItem,
  ItemType,
  ItemVisibilityType,
  MimeTypes,
  S3FileItemExtra,
  TagCategory,
  UUID,
} from '@graasp/sdk';

import { BaseLogger } from '../../../../../../logger';
import * as repositoriesModule from '../../../../../../utils/repositories';
import FileService from '../../../../../file/service';
import { ItemMembershipRepository } from '../../../../../itemMembership/repository';
import { Tag } from '../../../../../tag/Tag.entity';
import { Item } from '../../../../entities/Item';
import { ItemTestUtils } from '../../../../test/fixtures/items';
import { ItemLikeRepository } from '../../../itemLike/repository';
import { ItemVisibility } from '../../../itemVisibility/ItemVisibility';
import { ItemTagRepository } from '../../../tag/ItemTag.repository';
import { ItemPublished } from '../entities/itemPublished';
import { MeiliSearchWrapper } from '../plugins/search/meilisearch';
import { ItemPublishedRepository } from '../repositories/itemPublished';

jest.unmock('../plugins/search/meilisearch');

const testUtils = new ItemTestUtils();

const mockItemPublished = ({ id, path }: { id: string; path: string }) => {
  return {
    item: {
      id,
      createdAt: Date(),
      updatedAt: Date(),
      type: ItemType.FOLDER,
      path,
    } as unknown as Item,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ItemPublished;
};

describe('MeilisearchWrapper', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const datasourceManager = {
    getRepository: jest.fn(),
  } as unknown as jest.Mocked<EntityManager>;
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
  } as unknown as jest.Mocked<BaseLogger>;
  const fileService = {} as jest.Mocked<FileService>;

  const datasource = {
    transaction: jest.fn(),
  } as unknown as jest.Mocked<DataSource>;

  const mockTransaction = (isolation, fn) => {
    // Execute the callback function to run the actual code
    return fn(datasourceManager);
  };

  // Forcing typescript because mocking an overloaded function in typesafe way is a pain
  datasource.transaction.mockImplementation(
    mockTransaction as jest.MockedFunction<typeof DataSource.prototype.transaction>,
  );

  const mockIndex = {
    addDocuments: jest.fn(() => {
      return Promise.resolve({ taskUid: '1' } as unknown as EnqueuedTask);
    }),
    waitForTask: jest.fn(() => {
      return Promise.resolve({ status: TaskStatus.TASK_SUCCEEDED } as Task);
    }),
    waitForTasks: jest.fn(() => {
      return Promise.resolve({ status: TaskStatus.TASK_SUCCEEDED } as Task);
    }),
    deleteDocuments: jest.fn(() => {
      return Promise.resolve({ taskUid: '1' } as unknown as EnqueuedTask);
    }),
    deleteAllDocuments: jest.fn(() => {
      return Promise.resolve({ taskUid: '1' } as unknown as EnqueuedTask);
    }),
    updateSettings: jest.fn(() => {
      return Promise.resolve({ taskUid: '1' } as unknown as EnqueuedTask);
    }),
  } as unknown as jest.Mocked<Index<IndexItem>>;

  //const meilisearchConnection = {} as unknown as jest.Mocked<MeiliSearch>;
  const fakeClient = new MeiliSearch({
    host: 'fake',
    apiKey: 'fake',
    httpClient: () => Promise.resolve(),
  });

  jest.spyOn(fakeClient, 'getIndex').mockResolvedValue(mockIndex);
  jest.spyOn(fakeClient, 'index').mockReturnValue({
    updateFaceting: jest.fn(async () => {
      return { taskUid: '1' } as unknown as EnqueuedTask;
    }),
  } as never);
  jest
    .spyOn(fakeClient, 'swapIndexes')
    .mockResolvedValue({ taskUid: '1' } as unknown as EnqueuedTask);
  jest
    .spyOn(fakeClient, 'waitForTask')
    .mockResolvedValue({ status: TaskStatus.TASK_SUCCEEDED } as Task);

  const meilisearch = new MeiliSearchWrapper(datasource, fakeClient, fileService, logger);

  const itemPublishedRepositoryMock = {
    getForItem: jest.fn(),
    getPaginatedItems: jest.fn(),
  } as unknown as jest.Mocked<ItemPublishedRepository>;

  const itemTagRepositoryMock = {
    getByItemId: jest.fn(),
  } as unknown as jest.Mocked<ItemTagRepository>;

  const itemLikeRepositoryMock = {
    getCountByItemId: jest.fn(),
  } as unknown as jest.Mocked<ItemLikeRepository>;

  const repositories = {
    itemMembershipRepository: {
      getInherited: jest.fn(() => ({ permission: 'anything' })),
    } as unknown as jest.Mocked<typeof ItemMembershipRepository>,
    itemVisibilityRepository: testUtils.itemVisibilityRepository,
    itemRepository: testUtils.itemRepository,
    itemPublishedRepository: itemPublishedRepositoryMock,
    itemTagRepository: itemTagRepositoryMock,
    itemLikeRepository: itemLikeRepositoryMock,
  } as unknown as jest.Mocked<repositoriesModule.Repositories>;

  describe('search', () => {
    const searchSpy = jest
      .spyOn(MeiliSearch.prototype, 'multiSearch')
      .mockResolvedValue({} as MultiSearchResponse);

    it('search is delegated to meilisearch SDK', async () => {
      // Create a mock DataSource object

      const userQuery: MultiSearchParams = {
        queries: [{ q: 'random query', filter: 'random filter', indexUid: 'index' }],
      };
      await meilisearch.search(userQuery);

      expect(searchSpy).toHaveBeenCalledTimes(1);
      expect(searchSpy.mock.calls[0][0]).toMatchObject(userQuery);
    });
  });

  describe('index', () => {
    it('uses the sdk to index', async () => {
      const item = testUtils.createItem();

      // Given
      jest.spyOn(testUtils.itemRepository, 'getDescendants').mockResolvedValue([]);
      itemTagRepositoryMock.getByItemId.mockResolvedValue([]);
      const itemPublished = mockItemPublished(item);
      itemPublishedRepositoryMock.getForItem.mockResolvedValue(itemPublished);
      jest.spyOn(testUtils.itemVisibilityRepository, 'getManyBelowAndSelf').mockResolvedValue([]);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(itemPublished, repositories);

      // Then
      expect(addDocumentSpy).toHaveBeenCalledTimes(1);
      expect(addDocumentSpy.mock.calls[0][0][0]).toMatchObject({
        id: item.id,
        level: [],
        discipline: [],
        'resource-type': [],
        content: '',
        isPublishedRoot: true,
        isHidden: false,
      });
    });

    it('index descendants', async () => {
      const item = testUtils.createItem();
      const descendant = testUtils.createItem();
      const descendant2 = testUtils.createItem();
      // Given
      jest
        .spyOn(testUtils.itemRepository, 'getDescendants')
        .mockResolvedValue([descendant, descendant2]);
      itemTagRepositoryMock.getByItemId.mockResolvedValue([]);
      const itemPublished = mockItemPublished(item);
      itemPublishedRepositoryMock.getForItem.mockResolvedValue(itemPublished);
      jest.spyOn(testUtils.itemVisibilityRepository, 'getManyBelowAndSelf').mockResolvedValue([
        {
          type: ItemVisibilityType.Hidden,
          item: { id: descendant.id, path: descendant.path } as Item,
        } as ItemVisibility,
      ]);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(itemPublished, repositories);

      // Then
      expect(addDocumentSpy).toHaveBeenCalledTimes(1);
      expect(addDocumentSpy.mock.calls[0][0]).toHaveLength(3);
      expect(addDocumentSpy.mock.calls[0][0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: item.id,
            level: [],
            discipline: [],
            'resource-type': [],
            content: '',
            isPublishedRoot: true,
            isHidden: false,
          }),
          expect.objectContaining({
            id: descendant.id,
            level: [],
            discipline: [],
            'resource-type': [],
            content: '',
            isPublishedRoot: false,
            isHidden: true,
          }),
          expect.objectContaining({
            id: descendant2.id,
            level: [],
            discipline: [],
            'resource-type': [],
            content: '',
            isPublishedRoot: false,
            isHidden: false,
          }),
        ]),
      );
    });

    it('can index multiple items', async () => {
      const item = testUtils.createItem();
      const descendant = testUtils.createItem();
      const descendant2 = testUtils.createItem();
      const item2 = testUtils.createItem();
      const descendant3 = testUtils.createItem();

      const descendants = {
        [item.id]: [descendant, descendant2],
        [item2.id]: [descendant3],
      } satisfies Record<string, Item[]>;

      // Given
      jest
        .spyOn(testUtils.itemRepository, 'getDescendants')
        .mockImplementation(async (item) => descendants[item.id]);
      itemTagRepositoryMock.getByItemId.mockResolvedValue([]);
      const itemPublished1 = mockItemPublished(item);
      itemPublishedRepositoryMock.getForItem.mockResolvedValue(itemPublished1);
      const itemPublished2 = mockItemPublished(item2);
      itemPublishedRepositoryMock.getForItem.mockResolvedValue(itemPublished2);
      jest.spyOn(testUtils.itemVisibilityRepository, 'getManyBelowAndSelf').mockResolvedValue([]);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.index([itemPublished1, itemPublished2], repositories);

      // Then
      expect(addDocumentSpy).toHaveBeenCalledTimes(1);
      expect(addDocumentSpy.mock.calls[0][0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: item.id,
          }),
          expect.objectContaining({
            id: descendant.id,
          }),
          expect.objectContaining({
            id: descendant2.id,
          }),
          expect.objectContaining({
            id: item2.id,
          }),
          expect.objectContaining({
            id: descendant3.id,
          }),
        ]),
      );
    });

    it('index correct tags and published state', async () => {
      const item = testUtils.createItem();
      const descendant = testUtils.createItem();
      const descendant2 = testUtils.createItem();

      const tags = {
        [item.id]: [
          { name: 'tag1', id: v4(), category: TagCategory.Discipline },
          { name: 'tag2', id: v4(), category: TagCategory.Level },
          { name: 'tag3', id: v4(), category: TagCategory.Level },
        ],
        [descendant.id]: [{ name: 'tag3', id: v4(), category: TagCategory.ResourceType }],
        [descendant2.id]: [],
      };

      const published = {
        [item.id]: mockItemPublished(item),
        [descendant.id]: mockItemPublished(item),
        [descendant2.id]: mockItemPublished(descendant2),
      } satisfies Record<string, ItemPublished>;

      jest
        .spyOn(testUtils.itemRepository, 'getDescendants')
        .mockResolvedValue([descendant, descendant2]);
      itemTagRepositoryMock.getByItemId.mockImplementation(
        jest.fn(async (id: UUID) => tags[id] as Tag[]),
      );
      itemPublishedRepositoryMock.getForItem.mockImplementation((i) =>
        Promise.resolve(published[i.id]),
      );
      jest.spyOn(testUtils.itemVisibilityRepository, 'getManyBelowAndSelf').mockResolvedValue([
        {
          type: ItemVisibilityType.Hidden,
          item: { id: descendant.id } as unknown as Item,
        } as ItemVisibility,
      ]);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(published[item.id], repositories);

      // Then
      expect(addDocumentSpy).toHaveBeenCalledTimes(1);
      expect(addDocumentSpy.mock.calls[0][0]).toHaveLength(3);
      expect(addDocumentSpy.mock.calls[0][0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: item.id,
            discipline: [tags[item.id][0].name],
            level: [tags[item.id][1].name, tags[item.id][2].name],
            'resource-type': [],
            content: '',
            isPublishedRoot: true,
            isHidden: false,
          }),
        ]),
      );
    });

    it('index likes', async () => {
      const item = testUtils.createItem();
      const descendant = testUtils.createItem();
      const descendant2 = testUtils.createItem();

      const published = {
        [item.id]: mockItemPublished(item),
        [descendant.id]: mockItemPublished(item),
        [descendant2.id]: mockItemPublished(descendant2),
      } satisfies Record<string, ItemPublished>;

      jest
        .spyOn(testUtils.itemRepository, 'getDescendants')
        .mockResolvedValue([descendant, descendant2]);
      itemTagRepositoryMock.getByItemId.mockResolvedValue([]);
      itemPublishedRepositoryMock.getForItem.mockImplementation((i) =>
        Promise.resolve(published[i.id]),
      );

      jest.spyOn(testUtils.itemVisibilityRepository, 'getManyBelowAndSelf').mockResolvedValue([
        {
          type: ItemVisibilityType.Hidden,
          item: { id: descendant.id } as Item,
        } as ItemVisibility,
      ]);

      itemLikeRepositoryMock.getCountByItemId.mockResolvedValue(2);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(published[item.id], repositories);

      // Then
      expect(addDocumentSpy).toHaveBeenCalledTimes(1);
      expect(addDocumentSpy.mock.calls[0][0]).toHaveLength(3);
      expect(addDocumentSpy.mock.calls[0][0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: item.id,
            likes: 2,
            content: '',
            isPublishedRoot: true,
            isHidden: false,
          }),
        ]),
      );
    });

    it('content is indexed', async () => {
      const item = testUtils.createItem();
      const extraS3 = {
        [ItemType.S3_FILE]: {
          mimetype: MimeTypes.PDF,
          content: 's3 content',
        },
      } as S3FileItemExtra;
      const descendant = testUtils.createItem({ type: ItemType.S3_FILE, extra: extraS3 });
      const extra = {
        [ItemType.DOCUMENT]: {
          content: 'my text is here',
        },
      };
      const descendant2 = testUtils.createItem({ type: ItemType.DOCUMENT, extra });
      // Given

      jest
        .spyOn(testUtils.itemRepository, 'getDescendants')
        .mockResolvedValue([descendant, descendant2]);
      itemTagRepositoryMock.getByItemId.mockResolvedValue([]);
      const itemPublished = mockItemPublished(item);
      itemPublishedRepositoryMock.getForItem.mockResolvedValue(itemPublished);
      jest.spyOn(testUtils.itemVisibilityRepository, 'getManyBelowAndSelf').mockResolvedValue([]);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(itemPublished, repositories);

      // Then
      expect(addDocumentSpy).toHaveBeenCalledTimes(1);
      expect(addDocumentSpy.mock.calls[0][0]).toHaveLength(3);
      expect(addDocumentSpy.mock.calls[0][0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: item.id,
            content: '',
          }),
          expect.objectContaining({
            id: descendant.id,
            content: 's3 content',
          }),
          expect.objectContaining({
            id: descendant2.id,
            content: 'my text is here',
          }),
        ]),
      );
    });
  });

  describe('delete', () => {
    it('uses the sdk to delete with descendants', async () => {
      const item = testUtils.createItem();
      const descendant = testUtils.createItem();
      const descendant2 = testUtils.createItem();

      jest
        .spyOn(testUtils.itemRepository, 'getDescendants')
        .mockResolvedValue([descendant, descendant2]);

      const deleteSpy = jest.spyOn(mockIndex, 'deleteDocuments');

      await meilisearch.deleteOne(item, repositories);

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy.mock.calls[0][0]).toHaveLength(3);
      expect(deleteSpy.mock.calls[0][0]).toMatchObject(
        expect.arrayContaining([item.id, descendant.id, descendant2.id]),
      );
    });
  });

  describe('rebuilds index', () => {
    // it('reindex all items', async () => {
    //   const publishedItemsInDb = Array.from({ length: 13 }, (_, index) => {
    //     return mockItemPublished(index.toString());
    //   });
    //   jest.spyOn(repositoriesModule, 'buildRepositories').mockReturnValue(repositories);
    //   // prevent finding any PDFs to store because this part is temporary
    //   jest.spyOn(testUtils.itemRepository, 'findAndCount').mockResolvedValue([[], 0]);
    //   // fake pagination
    //   itemPublishedRepositoryMock.getPaginatedItems.mockImplementation((page, _) => {
    //     if (page === 1) {
    //       return Promise.resolve([publishedItemsInDb.slice(0, 10), publishedItemsInDb.length]);
    //     } else if (page === 2) {
    //       return Promise.resolve([publishedItemsInDb.slice(10), publishedItemsInDb.length]);
    //     } else {
    //       throw new Error();
    //     }
    //   });
    //   const indexSpy = jest
    //     .spyOn(MeiliSearchWrapper.prototype, 'index')
    //     .mockResolvedValue({ taskUid: '1' } as unknown as EnqueuedTask);
    //   await meilisearch.rebuildIndex(10);
    //   expect(indexSpy).toHaveBeenCalledTimes(2);
    //   expect(indexSpy.mock.calls[0][0]).toEqual(
    //     publishedItemsInDb.slice(0, 10).map((pi) => pi.item),
    //   );
    //   expect(indexSpy.mock.calls[1][0]).toEqual(publishedItemsInDb.slice(10).map((pi) => pi.item));
    // });
  });
});
