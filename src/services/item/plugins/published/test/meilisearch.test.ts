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

import { FastifyBaseLogger } from 'fastify';

import { IndexItem, ItemType, MimeTypes, S3FileItemExtra } from '@graasp/sdk';

import * as repositoriesModule from '../../../../../utils/repositories.js';
import FileService from '../../../../file/service.js';
import { ItemMembershipRepository } from '../../../../itemMembership/repository.js';
import { Item } from '../../../entities/Item.js';
import { ItemTestUtils } from '../../../test/fixtures/items.js';
import { ItemCategory } from '../../itemCategory/entities/ItemCategory.js';
import { ItemCategoryRepository } from '../../itemCategory/repositories/itemCategory.js';
import { ItemPublished } from '../entities/itemPublished.js';
import { MeiliSearchWrapper } from '../plugins/search/meilisearch.js';
import { ItemPublishedRepository } from '../repositories/itemPublished.js';

jest.unmock('../plugins/search/meilisearch');

// mock datasource
jest.mock('../../../../../plugins/datasource');
const testUtils = new ItemTestUtils();

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
  } as unknown as jest.Mocked<FastifyBaseLogger>;
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

  const itemCategoryRepositoryMock = {
    getForItemOrParent: jest.fn(),
  } as unknown as jest.Mocked<typeof ItemCategoryRepository>;

  const repositories = {
    itemMembershipRepository: {
      getInherited: jest.fn(() => ({ permission: 'anything' })),
    } as unknown as jest.Mocked<typeof ItemMembershipRepository>,
    itemTagRepository: testUtils.itemTagRepository,
    itemRepository: testUtils.itemRepository,
    itemPublishedRepository: itemPublishedRepositoryMock,
    itemCategoryRepository: itemCategoryRepositoryMock,
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
      jest.spyOn(testUtils.itemRepository, 'getManyDescendants').mockResolvedValue([]);
      itemCategoryRepositoryMock.getForItemOrParent.mockResolvedValue([]);
      itemPublishedRepositoryMock.getForItem.mockResolvedValue({
        item: { id: item.id } as Item,
      } as ItemPublished);
      jest
        .spyOn(testUtils.itemTagRepository, 'hasForMany')
        .mockResolvedValue({ data: {}, errors: [] });

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(item, repositories);

      // Then
      expect(addDocumentSpy).toHaveBeenCalledTimes(1);
      expect(addDocumentSpy.mock.calls[0][0][0]).toMatchObject({
        id: item.id,
        categories: [],
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
        .spyOn(testUtils.itemRepository, 'getManyDescendants')
        .mockResolvedValue([descendant, descendant2]);
      itemCategoryRepositoryMock.getForItemOrParent.mockResolvedValue([]);
      itemPublishedRepositoryMock.getForItem.mockResolvedValue({
        item: { id: item.id } as Item,
      } as ItemPublished);
      jest.spyOn(testUtils.itemTagRepository, 'hasForMany').mockResolvedValue({
        data: { [descendant.id]: true },
        errors: [],
      });

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(item, repositories);

      // Then
      expect(addDocumentSpy).toHaveBeenCalledTimes(1);
      expect(addDocumentSpy.mock.calls[0][0]).toHaveLength(3);
      expect(addDocumentSpy.mock.calls[0][0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: item.id,
            categories: [],
            content: '',
            isPublishedRoot: true,
            isHidden: false,
          }),
          expect.objectContaining({
            id: descendant.id,
            categories: [],
            content: '',
            isPublishedRoot: false,
            isHidden: true,
          }),
          expect.objectContaining({
            id: descendant2.id,
            categories: [],
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
      jest.spyOn(testUtils.itemRepository, 'getManyDescendants').mockImplementation((items) => {
        const result: Item[] = [];
        for (const i of items) {
          result.push(...descendants[i.id]);
        }
        return Promise.resolve(result);
      });
      itemCategoryRepositoryMock.getForItemOrParent.mockResolvedValue([]);
      itemPublishedRepositoryMock.getForItem.mockResolvedValue({
        item: { id: item.id } as Item,
      } as ItemPublished);
      jest
        .spyOn(testUtils.itemTagRepository, 'hasForMany')
        .mockResolvedValue({ data: {}, errors: [] });

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.index([item, item2], repositories);

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

    it('index correct categories and published state', async () => {
      const item = testUtils.createItem();
      const descendant = testUtils.createItem();
      const descendant2 = testUtils.createItem();
      // Given
      const mockItemCategory = (id) => {
        return {
          category: {
            id: id,
          },
        } as ItemCategory;
      };
      const mockItemPublished = (id) => {
        return { item: { id: id } as Item } as ItemPublished;
      };
      const categories = {
        [item.id]: [
          mockItemCategory('category1'),
          mockItemCategory('category2'),
          mockItemCategory('category2'),
        ], // duplicates should be removed
        [descendant.id]: [mockItemCategory('category2')],
        [descendant2.id]: [],
      } satisfies Record<string, ItemCategory[]>;

      const published = {
        [item.id]: mockItemPublished(item.id),
        [descendant.id]: mockItemPublished(item.id),
        [descendant2.id]: mockItemPublished(descendant2.id),
      } satisfies Record<string, ItemPublished>;

      jest
        .spyOn(testUtils.itemRepository, 'getManyDescendants')
        .mockResolvedValue([descendant, descendant2]);
      itemCategoryRepositoryMock.getForItemOrParent.mockImplementation((i) =>
        Promise.resolve(categories[i.id]),
      );
      itemPublishedRepositoryMock.getForItem.mockImplementation((i) =>
        Promise.resolve(published[i.id]),
      );
      jest.spyOn(testUtils.itemTagRepository, 'hasForMany').mockResolvedValue({
        data: { [descendant.id]: true },
        errors: [],
      });

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(item, repositories);

      // Then
      expect(addDocumentSpy).toHaveBeenCalledTimes(1);
      expect(addDocumentSpy.mock.calls[0][0]).toHaveLength(3);
      expect(addDocumentSpy.mock.calls[0][0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: item.id,
            categories: ['category1', 'category2'],
            content: '',
            isPublishedRoot: true,
            isHidden: false,
          }),
          expect.objectContaining({
            id: descendant.id,
            categories: ['category2'],
            content: '',
            isPublishedRoot: false,
            isHidden: true,
          }),
          expect.objectContaining({
            id: descendant2.id,
            categories: [],
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
        .spyOn(testUtils.itemRepository, 'getManyDescendants')
        .mockResolvedValue([descendant, descendant2]);
      itemCategoryRepositoryMock.getForItemOrParent.mockResolvedValue([]);
      itemPublishedRepositoryMock.getForItem.mockResolvedValue({
        item: { id: item.id } as Item,
      } as ItemPublished);
      jest
        .spyOn(testUtils.itemTagRepository, 'hasForMany')
        .mockResolvedValue({ data: {}, errors: [] });

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(item, repositories);

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
    it('reindex all items', async () => {
      const publishedItemsInDb = Array.from({ length: 13 }, (_, index) => {
        return { item: { id: index.toString() } as Item } as ItemPublished;
      });

      jest.spyOn(repositoriesModule, 'buildRepositories').mockReturnValue(repositories);

      // prevent finding any PDFs to store because this part is temporary
      jest.spyOn(testUtils.itemRepository, 'findAndCount').mockResolvedValue([[], 0]);

      // fake pagination
      itemPublishedRepositoryMock.getPaginatedItems.mockImplementation((page, _) => {
        if (page === 1) {
          return Promise.resolve([publishedItemsInDb.slice(0, 10), publishedItemsInDb.length]);
        } else if (page === 2) {
          return Promise.resolve([publishedItemsInDb.slice(10), publishedItemsInDb.length]);
        } else {
          throw new Error();
        }
      });
      const indexSpy = jest
        .spyOn(MeiliSearchWrapper.prototype, 'index')
        .mockResolvedValue({ taskUid: '1' } as unknown as EnqueuedTask);

      await meilisearch.rebuildIndex(10);

      expect(indexSpy).toHaveBeenCalledTimes(2);
      expect(indexSpy.mock.calls[0][0]).toEqual(
        publishedItemsInDb.slice(0, 10).map((pi) => pi.item),
      );
      expect(indexSpy.mock.calls[1][0]).toEqual(publishedItemsInDb.slice(10).map((pi) => pi.item));
    });
  });
});
