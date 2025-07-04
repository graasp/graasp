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

import { type IndexItem } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../../../../test/app';
import { ItemFactory } from '../../../../../../../../test/factories/item.factory';
import { type DBConnection } from '../../../../../../../drizzle/db';
import type { ItemPublishedWithItemWithCreator } from '../../../../../../../drizzle/types';
import { ItemRepository } from '../../../../../item.repository';
import { ItemPublishedRepository } from '../../itemPublished.repository';
import { MeiliSearchWrapper } from './meilisearch';
import { MeilisearchRepository } from './meilisearch.repository';

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
  updateSettings: jest.fn(() => {
    return Promise.resolve({ taskUid: '1' } as unknown as EnqueuedTask);
  }),
  waitForTask: jest.fn(() => {
    return Promise.resolve({ status: TaskStatus.TASK_SUCCEEDED } as Task);
  }),
} as never);
jest
  .spyOn(fakeClient, 'swapIndexes')
  .mockResolvedValue({ taskUid: '1' } as unknown as EnqueuedTask);
jest
  .spyOn(fakeClient, 'waitForTask')
  .mockResolvedValue({ status: TaskStatus.TASK_SUCCEEDED } as Task);

const itemPublishedRepository = new ItemPublishedRepository();
const itemRepository = new ItemRepository();
const meilisearchRepository = new MeilisearchRepository();

const meilisearch = new MeiliSearchWrapper(
  fakeClient,
  itemRepository,
  meilisearchRepository,
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
      const itemPublished = mockItemPublished(item);
      jest.spyOn(meilisearchRepository, 'getIndexedTree').mockResolvedValue([{} as never]);

      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.indexOne(MOCK_DB, itemPublished);

      // Then
      expect(addDocumentSpy).toHaveBeenCalledTimes(1);
    });

    it('can index multiple items', async () => {
      // Given
      const itemPublished1 = mockItemPublished(ItemFactory());
      jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(itemPublished1);
      const itemPublished2 = mockItemPublished(ItemFactory());
      jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(itemPublished2);
      const getIndexTreeMock = jest
        .spyOn(meilisearchRepository, 'getIndexedTree')
        .mockResolvedValue([{} as never]);
      const addDocumentSpy = jest.spyOn(mockIndex, 'addDocuments');

      // When
      await meilisearch.index(MOCK_DB, [itemPublished1, itemPublished2]);

      // Then
      expect(addDocumentSpy).toHaveBeenCalledTimes(1);
      expect(getIndexTreeMock).toHaveBeenCalledTimes(2);
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
});
