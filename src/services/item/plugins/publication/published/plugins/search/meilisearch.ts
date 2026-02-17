import { Queue } from 'bullmq';
import { SQL, count, eq } from 'drizzle-orm';
import { EnqueuedTask, Index, MeiliSearch, type MultiSearchParams } from 'meilisearch';
import { singleton } from 'tsyringe';

import { type IndexItem } from '@graasp/sdk';

import { REDIS_CONNECTION } from '../../../../../../../config/redis';
import { type DBConnection } from '../../../../../../../drizzle/db';
import { items } from '../../../../../../../drizzle/schema';
import type { ItemPublishedWithItemWithCreator } from '../../../../../../../drizzle/types';
import { BaseLogger } from '../../../../../../../logger';
import { ItemType } from '../../../../../../../schemas/global';
import { Queues } from '../../../../../../../workers/config';
import { ItemRaw, isFolderItem } from '../../../../../item';
import { ItemRepository } from '../../../../../item.repository';
import { MeilisearchRepository } from './meilisearch.repository';
import type { Hit } from './search.schemas';

export const ACTIVE_INDEX = 'itemIndex';
export const ROTATING_INDEX = 'itemIndex_tmp'; // Used when reindexing

export type AllowedIndices = typeof ACTIVE_INDEX | typeof ROTATING_INDEX;

/*
 * Handle search index business logic with Meilisearch
 * Ideally we try to keep the public method idempotent. You can "delete" unexisting items and indexing work for first indexation and for updates.
 */
@singleton()
export class MeiliSearchWrapper {
  private readonly meilisearchClient: MeiliSearch;
  private readonly indexDictionary: Record<string, Index<IndexItem>> = {};
  private readonly logger: BaseLogger;
  private readonly itemRepository: ItemRepository;
  private readonly meilisearchRepository: MeilisearchRepository;
  private readonly searchQueue: Queue;

  constructor(
    meilisearchConnection: MeiliSearch,
    itemRepository: ItemRepository,
    meilisearchRepository: MeilisearchRepository,
    logger: BaseLogger,
  ) {
    this.meilisearchClient = meilisearchConnection;
    this.itemRepository = itemRepository;
    this.meilisearchRepository = meilisearchRepository;
    this.logger = logger;

    this.searchQueue = new Queue(Queues.SearchIndex.queueName, {
      connection: { url: REDIS_CONNECTION },
    });

    // create index in the background if it doesn't exist
    this.getIndex();
  }

  private async logTaskCompletion(task: EnqueuedTask, itemName: string) {
    try {
      const finishedTask = await (await this.getIndex()).waitForTask(task.taskUid);
      this.logger.info(
        `Meilisearch ${task.type} task completed (${task.status}): item name => ${itemName}. ${
          finishedTask.error ? `Error: ${finishedTask.error}` : ''
        }`,
      );
    } catch (_e) {
      // catch timeout while waiting
    }
  }

  public getActiveIndexName() {
    return ACTIVE_INDEX;
  }

  /* Lazily create or get the index at first request and cache it in the dictionary
   * We need a Index object to do operations on meilisearch indices, but we get the index with an API call
   * This method wraps getting an Index, and stores it in a local dictionary, so we don't need to call the API again
   */
  private async getIndex(name: AllowedIndices = ACTIVE_INDEX): Promise<Index<IndexItem>> {
    if (this.indexDictionary[name]) {
      return this.indexDictionary[name];
    }

    const indexes = await this.meilisearchClient.getIndexes();
    const index = indexes.results.find(({ uid }) => uid === name);
    if (index) {
      this.indexDictionary[name] = index;
      return index;
    } else {
      const task = await this.meilisearchClient.createIndex(name);
      await this.meilisearchClient.waitForTask(task.taskUid);

      // If main index just got created, rebuild it in the background
      if (name === ACTIVE_INDEX) {
        this.logger.info('Search index just created, rebuilding index...');

        this.searchQueue.add(
          Queues.SearchIndex.jobs.buildIndex,
          {},
          { deduplication: { id: Queues.SearchIndex.jobs.buildIndex } },
        );
      }
      const index = await this.meilisearchClient.getIndex(name);

      this.indexDictionary[name] = index;
      return index;
    }
  }

  // WORKS ONLY FOR PUBLISHED ITEMS
  async search(queries: MultiSearchParams) {
    // type should match schema
    const searchResult = await this.meilisearchClient.multiSearch<Hit>(queries);
    return searchResult;
  }

  async indexOne(
    dbConnection: DBConnection,
    itemPublished: ItemPublishedWithItemWithCreator,
    targetIndex: AllowedIndices = ACTIVE_INDEX,
  ): Promise<EnqueuedTask> {
    return this.index(dbConnection, [itemPublished], targetIndex);
  }

  async index(
    dbConnection: DBConnection,
    manyItemPublished: ItemPublishedWithItemWithCreator[],
    targetIndex: AllowedIndices = ACTIVE_INDEX,
  ) {
    try {
      let documents: IndexItem[] = [];
      for (const { itemPath } of manyItemPublished) {
        documents = documents.concat(
          await this.meilisearchRepository.getIndexedTree(dbConnection, itemPath),
        );
      }
      const index = await this.getIndex(targetIndex);
      const indexingTask = await index.addDocuments(documents);
      this.logTaskCompletion(
        indexingTask,
        documents
          .slice(0, 30) // Avoid logging too many items
          .map((i) => i.name)
          .join(';'),
      );

      return indexingTask;
    } catch (err) {
      this.logger.error('There was a problem adding items to meilisearch ' + err);
      throw err;
    }
  }

  async deleteOne(dbConnection: DBConnection, item: ItemRaw) {
    try {
      let itemsToIndex = [item];
      if (isFolderItem(item)) {
        itemsToIndex = itemsToIndex.concat(
          await this.itemRepository.getDescendants(dbConnection, item),
        );
      }

      const documentIds = itemsToIndex.map((i) => i.id);
      const indexingTask = await (await this.getIndex()).deleteDocuments(documentIds);
      this.logTaskCompletion(indexingTask, item.name);
    } catch (err) {
      this.logger.error(`There was a problem adding item ${item.id} to meilisearch: ${err}`);
    }
  }

  async updateItem(id: string, properties: Partial<IndexItem>) {
    await this.meilisearchClient.index(ACTIVE_INDEX).updateDocuments([
      {
        id,
        ...properties,
      },
    ]);
  }

  async indexIntegrityFix() {
    throw new Error('Not implemented');
    // "smart version" of rebuild
    // currently we only do the "bruteforce" rebuildIndex() approach as it's quick enough

    // Paginate with cursor through DB items (serializable transaction)
    // Retrieve a page (i.e. 20 items)
    // Retrieve the same ids from index
    // compare data (check if updatedAt is more recent)
    // Reindex the modified and unexisting items
  }

  async getHealth() {
    return this.meilisearchClient.health();
  }

  async findAndCountItems(
    dbConnection: DBConnection,
    args: { where: { type: ItemType }; take: number; skip: number; order: SQL },
  ): Promise<[ItemRaw[], number]> {
    const result = await dbConnection
      .select()
      .from(items)
      .where(eq(items.type, args.where.type))
      .orderBy(args.order)
      .limit(args.take)
      .offset(args.skip);

    const totalCount = (
      await dbConnection
        .select({ count: count() })
        .from(items)
        .where(eq(items.type, args.where.type))
    )[0].count;

    return [result, totalCount];
  }
}
