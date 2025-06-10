import { expect, jest } from '@jest/globals';
import {
  EnqueuedTask,
  Index,
  MeiliSearch,
  type MultiSearchParams,
  type MultiSearchResponse,
  Task,
  TaskStatus,
} from 'meilisearch';
import { v4 } from 'uuid';

import {
  type IndexItem,
  ItemType,
  ItemVisibilityType,
  MimeTypes,
  TagCategory,
  type UUID,
} from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../../../../test/app';
import { ItemFactory } from '../../../../../../../../test/factories/item.factory';
import { type DBConnection, db } from '../../../../../../../drizzle/db';
import type {
  ItemPublishedWithItem,
  ItemPublishedWithItemWithCreator,
  ItemRaw,
  ItemVisibilityWithItem,
} from '../../../../../../../drizzle/types';
import FileService from '../../../../../../file/file.service';
import { ItemRepository } from '../../../../../item.repository';
import { ItemLikeRepository } from '../../../../itemLike/itemLike.repository';
import { ItemVisibilityRepository } from '../../../../itemVisibility/itemVisibility.repository';
import { ItemTagRepository } from '../../../../tag/ItemTag.repository';
import { ItemPublishedRepository } from '../../itemPublished.repository';
import { MeiliSearchWrapper } from './meilisearch';

jest.unmock('./meilisearch');

const mockItemPublished = ({
  id,
  path,
}: {
  id: string;
  path: string;
}): ItemPublishedWithItemWithCreator => {
  return {
    id,
    creatorId: v4(),
    item: { ...ItemFactory({ id, path }), creator: null },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    itemPath: path,
  };
};

const MOCK_DB = {} as DBConnection;

const fileService = {} as jest.Mocked<FileService>;

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

const itemPublishedRepository = new ItemPublishedRepository();
const itemTagRepository = new ItemTagRepository();
const itemLikeRepository = new ItemLikeRepository();
const itemRepository = new ItemRepository();
const itemVisibilityRepository = new ItemVisibilityRepository();

const meilisearch = new MeiliSearchWrapper(
  fakeClient,
  fileService,
  itemVisibilityRepository,
  itemRepository,
  itemPublishedRepository,
  itemTagRepository,
  itemLikeRepository,
  MOCK_LOGGER,
);

describe('MeilisearchWrapper', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

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
      const item = ItemFactory();

      // Given
      jest.spyOn(itemRepository, 'getDescendants').mockResolvedValue([]);
      jest.spyOn(itemTagRepository, 'getByItemId').mockResolvedValue([]);
      const itemPublished = mockItemPublished(item);
      jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(itemPublished);
      jest.spyOn(itemVisibilityRepository, 'getManyBelowAndSelf').mockResolvedValue([]);
      jest.spyOn(itemLikeRepository, 'getCountByItemId').mockResolvedValue(0);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(MOCK_DB, itemPublished);

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
      const item = ItemFactory();
      const descendant = ItemFactory();
      const descendant2 = ItemFactory();
      // Given
      jest.spyOn(itemRepository, 'getDescendants').mockResolvedValue([descendant, descendant2]);
      jest.spyOn(itemTagRepository, 'getByItemId').mockResolvedValue([]);
      const itemPublished = mockItemPublished(item);
      jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(itemPublished);
      jest.spyOn(itemLikeRepository, 'getCountByItemId').mockResolvedValue(0);
      jest.spyOn(itemVisibilityRepository, 'getManyBelowAndSelf').mockResolvedValue([
        {
          type: ItemVisibilityType.Hidden,
          item: { id: descendant.id, path: descendant.path } as ItemRaw,
        } as ItemVisibilityWithItem,
      ]);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(MOCK_DB, itemPublished);

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
      const item = ItemFactory();
      const descendant = ItemFactory();
      const descendant2 = ItemFactory();
      const item2 = ItemFactory();
      const descendant3 = ItemFactory();

      const descendants = {
        [item.id]: [descendant, descendant2],
        [item2.id]: [descendant3],
      } satisfies Record<string, ItemRaw[]>;

      // Given
      jest
        .spyOn(itemRepository, 'getDescendants')
        .mockImplementation(async (_db, item) => descendants[item.id]);
      jest.spyOn(itemTagRepository, 'getByItemId').mockResolvedValue([]);
      const itemPublished1 = mockItemPublished(item);
      jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(itemPublished1);
      const itemPublished2 = mockItemPublished(item2);
      jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(itemPublished2);
      jest.spyOn(itemVisibilityRepository, 'getManyBelowAndSelf').mockResolvedValue([]);
      jest.spyOn(itemLikeRepository, 'getCountByItemId').mockResolvedValue(0);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.index(MOCK_DB, [itemPublished1, itemPublished2]);

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
      const item = ItemFactory();
      const descendant = ItemFactory();
      const descendant2 = ItemFactory();

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
        [item.path]: mockItemPublished(item),
        [descendant.path]: mockItemPublished(item),
        [descendant2.path]: mockItemPublished(descendant2),
      } satisfies Record<string, ItemPublishedWithItemWithCreator>;

      jest.spyOn(itemRepository, 'getDescendants').mockResolvedValue([descendant, descendant2]);
      jest
        .spyOn(itemTagRepository, 'getByItemId')
        .mockImplementation(async (_db, id: UUID) => tags[id]);
      jest
        .spyOn(itemPublishedRepository, 'getForItem')
        .mockImplementation((_db, path) => Promise.resolve(published[path]));
      jest.spyOn(itemVisibilityRepository, 'getManyBelowAndSelf').mockResolvedValue([
        {
          type: ItemVisibilityType.Hidden,
          item: { id: descendant.id },
        } as ItemVisibilityWithItem,
      ]);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(MOCK_DB, published[item.path]);

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
      const item = ItemFactory();
      const descendant = ItemFactory();
      const descendant2 = ItemFactory();

      const published = {
        [item.path]: mockItemPublished(item),
        [descendant.path]: mockItemPublished(item),
        [descendant2.path]: mockItemPublished(descendant2),
      } satisfies Record<string, ItemPublishedWithItem>;

      jest.spyOn(itemRepository, 'getDescendants').mockResolvedValue([descendant, descendant2]);
      jest.spyOn(itemTagRepository, 'getByItemId').mockResolvedValue([]);
      jest
        .spyOn(itemPublishedRepository, 'getForItem')
        .mockImplementation(async (_db, path) => published[path]);

      jest.spyOn(itemVisibilityRepository, 'getManyBelowAndSelf').mockResolvedValue([
        {
          type: ItemVisibilityType.Hidden,
          item: { id: descendant.id },
        } as ItemVisibilityWithItem,
      ]);

      jest.spyOn(itemLikeRepository, 'getCountByItemId').mockResolvedValue(2);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(MOCK_DB, published[item.path]);

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
      const item = ItemFactory();
      const extraFile = {
        [ItemType.FILE]: {
          mimetype: MimeTypes.PDF,
          content: 's3 content',
        },
      };
      const descendant = ItemFactory({ type: ItemType.FILE, extra: extraFile });
      const extra = {
        [ItemType.DOCUMENT]: {
          content: 'my text is here',
        },
      };
      const descendant2 = ItemFactory({ type: ItemType.DOCUMENT, extra });
      // Given

      jest.spyOn(itemRepository, 'getDescendants').mockResolvedValue([descendant, descendant2]);
      jest.spyOn(itemTagRepository, 'getByItemId').mockResolvedValue([]);
      const itemPublished = mockItemPublished(item);
      jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(itemPublished);
      jest.spyOn(itemVisibilityRepository, 'getManyBelowAndSelf').mockResolvedValue([]);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(MOCK_DB, itemPublished);

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
      const item = ItemFactory();
      const descendant = ItemFactory();
      const descendant2 = ItemFactory();

      jest.spyOn(itemRepository, 'getDescendants').mockResolvedValue([descendant, descendant2]);

      const deleteSpy = jest.spyOn(mockIndex, 'deleteDocuments');

      await meilisearch.deleteOne(MOCK_DB, item);

      expect(deleteSpy).toHaveBeenCalledTimes(1);
      expect(deleteSpy.mock.calls[0][0]).toHaveLength(3);
      expect(deleteSpy.mock.calls[0][0]).toMatchObject(
        expect.arrayContaining([item.id, descendant.id, descendant2.id]),
      );
    });
  });

  describe('rebuilds index', () => {
    it('reindex all items', async () => {
      jest.spyOn(db, 'transaction').mockImplementation(async (fn) => await fn({} as never));
      const publishedItemsInDb = Array.from({ length: 13 }, (_, index) => {
        return mockItemPublished({ id: index.toString(), path: index.toString() });
      });
      // prevent finding any PDFs to store because this part is temporary
      jest.spyOn(meilisearch, 'findAndCountItems').mockResolvedValue([[], 0]);
      // fake pagination
      jest
        .spyOn(itemPublishedRepository, 'getPaginatedItems')
        .mockImplementation(async (_db, page, _) => {
          if (page === 1) {
            return [publishedItemsInDb.slice(0, 10), publishedItemsInDb.length];
          } else if (page === 2) {
            return [publishedItemsInDb.slice(10), publishedItemsInDb.length];
          } else {
            throw new Error();
          }
        });
      const indexSpy = jest
        .spyOn(MeiliSearchWrapper.prototype, 'index')
        .mockResolvedValue({ taskUid: '1' } as unknown as EnqueuedTask);

      await meilisearch.rebuildIndex(10);

      expect(indexSpy).toHaveBeenCalledTimes(2);
      expect(indexSpy.mock.calls[0][1]).toEqual(publishedItemsInDb.slice(0, 10));
      expect(indexSpy.mock.calls[1][1]).toEqual(publishedItemsInDb.slice(10));
    });
  });
});
