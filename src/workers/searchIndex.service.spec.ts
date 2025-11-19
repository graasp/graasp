import { EnqueuedTask, Index, MeiliSearch, Task, TaskStatus } from 'meilisearch';
import { v4 } from 'uuid';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type IndexItem } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../test/app.vitest';
import { ItemFactory } from '../../test/factories/item.factory';
import { db } from '../drizzle/db';
import { ItemPublishedWithItemWithCreator } from '../drizzle/types';
import { ItemPublishedRepository } from '../services/item/plugins/publication/published/itemPublished.repository';
import {
  ACTIVE_INDEX,
  MeiliSearchWrapper,
} from '../services/item/plugins/publication/published/plugins/search/meilisearch';
import { SearchIndexService } from './searchIndex.service';

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

const mockIndex = {
  uid: ACTIVE_INDEX,
  addDocuments: vi.fn(() => {
    return Promise.resolve({ taskUid: '1' } as unknown as EnqueuedTask);
  }),
  waitForTask: vi.fn(() => {
    return Promise.resolve({ status: TaskStatus.TASK_SUCCEEDED } as Task);
  }),
  waitForTasks: vi.fn(() => {
    return Promise.resolve({ status: TaskStatus.TASK_SUCCEEDED } as Task);
  }),
  deleteDocuments: vi.fn(() => {
    return Promise.resolve({ taskUid: '1' } as unknown as EnqueuedTask);
  }),
  deleteAllDocuments: vi.fn(() => {
    return Promise.resolve({ taskUid: '1' } as unknown as EnqueuedTask);
  }),
  updateSettings: vi.fn(() => {
    return Promise.resolve({ taskUid: '1' } as unknown as EnqueuedTask);
  }),
} as unknown as Index<IndexItem>;

const fakeClient = new MeiliSearch({
  host: 'fake',
  apiKey: 'fake',
  httpClient: () => Promise.resolve(),
});

vi.spyOn(fakeClient, 'getIndex').mockResolvedValue(mockIndex);
vi.spyOn(fakeClient, 'index').mockReturnValue({
  updateFaceting: vi.fn(async () => {
    return { taskUid: '1' } as unknown as EnqueuedTask;
  }),
  updateSettings: vi.fn(() => {
    return Promise.resolve({ taskUid: '1' } as unknown as EnqueuedTask);
  }),
  waitForTask: vi.fn(() => {
    return Promise.resolve({ status: TaskStatus.TASK_SUCCEEDED } as Task);
  }),
} as never);
vi.spyOn(fakeClient, 'swapIndexes').mockResolvedValue({ taskUid: '1' } as unknown as EnqueuedTask);
vi.spyOn(fakeClient, 'waitForTask').mockResolvedValue({
  status: TaskStatus.TASK_SUCCEEDED,
} as Task);

vi.spyOn(db, 'transaction').mockImplementation(async (fn) => await fn({} as never));

const itemPublishedRepository = new ItemPublishedRepository();
const meilisearchWrapper = {
  index: vi.fn(),
} as unknown as MeiliSearchWrapper;

const meilisearch = new SearchIndexService(
  fakeClient,
  itemPublishedRepository,
  meilisearchWrapper,
  MOCK_LOGGER,
);

describe('SearchIndexService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('builds index', () => {
    it('index all items', async () => {
      vi.spyOn(fakeClient, 'getIndexes').mockResolvedValue({ results: [mockIndex], total: 1 });
      vi.spyOn(fakeClient, 'createIndex').mockResolvedValue({ taskUid: 1 } as EnqueuedTask);
      const publishedItemsInDb = Array.from({ length: 13 }, (_, index) => {
        return mockItemPublished({ id: index.toString(), path: index.toString() });
      });
      vi.spyOn(itemPublishedRepository, 'getPaginatedItems').mockImplementation(
        async (_db, page, _) => {
          if (page === 1) {
            return [publishedItemsInDb.slice(0, 10), publishedItemsInDb.length];
          } else if (page === 2) {
            return [publishedItemsInDb.slice(10), publishedItemsInDb.length];
          } else {
            throw new Error();
          }
        },
      );
      const indexSpy = vi
        .spyOn(meilisearchWrapper, 'index')
        .mockResolvedValue({ taskUid: '1' } as unknown as EnqueuedTask);

      await meilisearch.buildIndex({ pageSize: 10 });

      expect(meilisearchWrapper.index).toHaveBeenCalledTimes(2);
      expect(indexSpy.mock.calls[0][1]).toEqual(publishedItemsInDb.slice(0, 10));
      expect(indexSpy.mock.calls[1][1]).toEqual(publishedItemsInDb.slice(10));
    });
    it('index all items when active index does not exist', async () => {
      // throw error when getting active index
      // should create index and start indexing
      vi.spyOn(fakeClient, 'getIndexes').mockResolvedValue({ results: [], total: 0 });
      vi.spyOn(fakeClient, 'createIndex').mockResolvedValue({ taskUid: 1 } as EnqueuedTask);

      const publishedItemsInDb = Array.from({ length: 13 }, (_, index) => {
        return mockItemPublished({ id: index.toString(), path: index.toString() });
      });
      vi.spyOn(itemPublishedRepository, 'getPaginatedItems').mockImplementation(
        async (_db, page, _) => {
          if (page === 1) {
            return [publishedItemsInDb.slice(0, 10), publishedItemsInDb.length];
          } else if (page === 2) {
            return [publishedItemsInDb.slice(10), publishedItemsInDb.length];
          } else {
            throw new Error();
          }
        },
      );
      const indexSpy = vi
        .spyOn(meilisearchWrapper, 'index')
        .mockResolvedValue({ taskUid: '1' } as unknown as EnqueuedTask);

      await meilisearch.buildIndex({ pageSize: 10 });

      expect(meilisearchWrapper.index).toHaveBeenCalledTimes(2);
      expect(indexSpy.mock.calls[0][1]).toEqual(publishedItemsInDb.slice(0, 10));
      expect(indexSpy.mock.calls[1][1]).toEqual(publishedItemsInDb.slice(10));
    });
    it('throw for unexpected error on getting index', async () => {
      const error = new Error('some error');
      vi.spyOn(fakeClient, 'getIndex').mockRejectedValue(error);

      await expect(meilisearch.buildIndex({ pageSize: 10 })).rejects.toThrow(error);
    });
  });
});
