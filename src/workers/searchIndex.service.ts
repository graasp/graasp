import {
  EnqueuedTask,
  Index,
  type MeiliSearch,
  MeiliSearchApiError,
  MeiliSearchTimeOutError,
  TypoTolerance,
} from 'meilisearch';
import { singleton } from 'tsyringe';

import { IndexItem } from '@graasp/sdk';

import { db } from '../drizzle/db';
import { BaseLogger } from '../logger';
import { ItemPublishedRepository } from '../services/item/plugins/publication/published/itemPublished.repository';
import {
  ACTIVE_INDEX,
  AllowedIndices,
  MeiliSearchWrapper,
  ROTATING_INDEX,
} from '../services/item/plugins/publication/published/plugins/search/meilisearch';
import { FILTERABLE_ATTRIBUTES } from '../services/item/plugins/publication/published/plugins/search/search.constants';
import { TagCategory } from '../services/tag/tag.schemas';

// Make index configuration typesafe
const SEARCHABLE_ATTRIBUTES: (keyof IndexItem)[] = [
  'name',
  'description',
  'content',
  'creator',
  ...Object.values(TagCategory),
];
const SORT_ATTRIBUTES: (keyof IndexItem)[] = [
  'name',
  'updatedAt',
  'createdAt',
  'publicationUpdatedAt',
  'likes',
];
const DISPLAY_ATTRIBUTES: (keyof IndexItem)[] = [
  'id',
  'name',
  'creator',
  'description',
  'type',
  'content',
  'createdAt',
  'updatedAt',
  'publicationUpdatedAt',
  'isPublishedRoot',
  'isHidden',
  'lang',
  'likes',
  TagCategory.Level,
  TagCategory.Discipline,
  TagCategory.ResourceType,
];

const TYPO_TOLERANCE: TypoTolerance = {
  enabled: true,
  minWordSizeForTypos: {
    oneTypo: 4,
    twoTypos: 6,
  },
};

@singleton()
export class SearchIndexService {
  private readonly meilisearchClient: MeiliSearch;
  private readonly meilisearchWrapper: MeiliSearchWrapper;
  private readonly itemPublishedRepository: ItemPublishedRepository;
  private readonly logger: BaseLogger;

  constructor(
    meilisearchConnection: MeiliSearch,
    itemPublishedRepository: ItemPublishedRepository,
    meilisearchWrapper: MeiliSearchWrapper,
    logger: BaseLogger,
  ) {
    this.meilisearchClient = meilisearchConnection;
    this.itemPublishedRepository = itemPublishedRepository;
    // TODO: remove once indexing a single item is a job
    this.meilisearchWrapper = meilisearchWrapper;
    this.logger = logger;
  }

  // to be executed by async job runner when desired
  async buildIndex({ pageSize = 10 }: { pageSize?: number } = {}) {
    // Ensure that there is an active index before rebuilding
    try {
      await this.meilisearchClient.getIndex(ACTIVE_INDEX);
    } catch (err) {
      if (err instanceof MeiliSearchApiError && err.code === 'index_not_found') {
        const task = await this.meilisearchClient.createIndex(ACTIVE_INDEX);
        await this.meilisearchClient.waitForTask(task.taskUid);
      }
      throw err;
    }

    this.logger.info('REBUILD INDEX: Starting index rebuild...');
    const tmpIndex = await this.getOrCreateIndex(ROTATING_INDEX);

    // Delete existing document if any
    this.logger.info('REBUILD INDEX: Cleaning temporary index...');
    await tmpIndex.waitForTask((await tmpIndex.deleteAllDocuments()).taskUid);

    await this.updateIndexSettings(ROTATING_INDEX);

    this.logger.info('REBUILD INDEX: Starting indexation...');

    // Paginate with cursor through DB items (serializable transaction)
    // This is not executed in a HTTP request context so we can't rely on fastify to create a transaction at the controller level
    // SERIALIZABLE because we don't want other transaction to affect this one while it goes through the pages.
    await db.transaction(
      async (tx) => {
        const tasks: EnqueuedTask[] = [];

        // instanciate the itempublished repository to use the provided transaction manager
        let currentPage = 1;
        let total = 0;
        while (currentPage === 1 || (currentPage - 1) * pageSize < total) {
          // Retrieve a page (i.e. 20 items)
          const [published, totalCount] = await this.itemPublishedRepository.getPaginatedItems(
            tx,
            currentPage,
            pageSize,
          );
          this.logger.info(
            `REBUILD INDEX: Page ${currentPage} - ${published.length} items - total count: ${totalCount}`,
          );
          total = totalCount;

          // Index items (1 task per page)
          try {
            // TODO: transform index into a job
            const task = await this.meilisearchWrapper.index(tx, published, ROTATING_INDEX);
            this.logger.info(
              `REBUILD INDEX: Pushing indexing task ${task.taskUid} (page ${currentPage})`,
            );
            tasks.push(task);
          } catch (e) {
            this.logger.error(`REBUILD INDEX: Error during one rebuild index task: ${e}`);
          }

          currentPage++;
        }
        this.logger.info(`REBUILD INDEX: Waiting for ${tasks.length} tasks to terminate...`);
        // Wait to be sure that everything is indexed
        // We don't use `waitForTasks` directly because we want to be able to handle error
        // for one task and still be able to await other tasks
        for (const taskUid of tasks.map((t) => t.taskUid)) {
          try {
            await tmpIndex.waitForTask(taskUid, { timeOutMs: 60_000, intervalMs: 1000 });
          } catch (e) {
            if (e instanceof MeiliSearchTimeOutError) {
              this.logger.info(
                `REBUILD INDEX: timeout from MeiliSearch while waiting for task ${taskUid}`,
              );
            } else {
              this.logger.warn(e);
            }
          }
        }
      },
      { isolationLevel: 'serializable' },
    );

    // Swap tmp index with actual index
    this.logger.info(`REBUILD INDEX: Swapping indexes...`);
    const swapTask = await this.meilisearchClient.swapIndexes([
      { indexes: [ACTIVE_INDEX, ROTATING_INDEX] },
    ]);
    await this.meilisearchClient.waitForTask(swapTask.taskUid);

    this.logger.info(`REBUILD INDEX: Index rebuild successful!`);

    await this.updateFacetSettings(ACTIVE_INDEX);
    await this.updateIndexSettings(ACTIVE_INDEX);

    this.logger.info(`REBUILD INDEX: Index settings and facets configuration successful!`);

    // Retry if the rebuild fail? Or let retry by a Bull task
  }

  /* return meilisearch index or create it
   */
  private async getOrCreateIndex(name: AllowedIndices): Promise<Index<IndexItem>> {
    try {
      const index = await this.meilisearchClient.getIndex(name);
      return index;
    } catch (err) {
      if (err instanceof MeiliSearchApiError && err.code === 'index_not_found') {
        const task = await this.meilisearchClient.createIndex(name);
        await this.meilisearchClient.waitForTask(task.taskUid);

        return await this.meilisearchClient.getIndex(name);
      }

      throw err;
    }
  }

  private async updateIndexSettings(indexName: AllowedIndices) {
    const index = this.meilisearchClient.index(indexName);
    // Update index config
    const updateSettingsTask = await index.updateSettings({
      searchableAttributes: SEARCHABLE_ATTRIBUTES,
      displayedAttributes: DISPLAY_ATTRIBUTES,
      filterableAttributes: [...FILTERABLE_ATTRIBUTES], // make a shallow copy because the initial parameter is readonly,
      sortableAttributes: SORT_ATTRIBUTES,
      typoTolerance: TYPO_TOLERANCE,
    });
    await index.waitForTask(updateSettingsTask.taskUid);
  }

  /**
   * Update facet settings for active index
   */
  private async updateFacetSettings(indexName: AllowedIndices) {
    // set facetting order to count for tag categories
    await this.meilisearchClient.index(indexName).updateFaceting({
      // return max 50 values per facet for facet distribution
      // it is interesting to receive a lot of values for listing
      maxValuesPerFacet: 50,
      sortFacetValuesBy: Object.fromEntries(Object.values(TagCategory).map((c) => [c, 'count'])),
    });
  }
}
