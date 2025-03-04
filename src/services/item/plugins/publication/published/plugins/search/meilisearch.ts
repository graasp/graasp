import {
  EnqueuedTask,
  Index,
  MeiliSearch,
  MeiliSearchApiError,
  MeiliSearchTimeOutError,
  MultiSearchParams,
  TypoTolerance,
} from 'meilisearch';

import {
  DocumentItemExtra,
  IndexItem,
  ItemType,
  ItemVisibilityType,
  LocalFileItemExtra,
  MimeTypes,
  S3FileItemExtra,
  TagCategory,
} from '@graasp/sdk';

import { DBConnection, db } from '../../../../../../../drizzle/db';
import {
  Item,
  ItemPublishedWithItemWithCreator,
  ItemWithCreator,
  TagRaw,
} from '../../../../../../../drizzle/types';
import { BaseLogger } from '../../../../../../../logger';
import { MEILISEARCH_STORE_LEGACY_PDF_CONTENT } from '../../../../../../../utils/config';
import FileService from '../../../../../../file/service';
import { ItemRepository } from '../../../../../repository';
import { readPdfContent } from '../../../../../utils';
import { ItemLikeRepository } from '../../../../itemLike/repository';
import { ItemVisibilityRepository } from '../../../../itemVisibility/repository';
import { ItemTagRepository } from '../../../../tag/ItemTag.repository';
import { stripHtml } from '../../../validation/utils';
import { ItemPublishedNotFound } from '../../errors';
import { ItemPublishedRepository } from '../../repositories/itemPublished';
import { Hit } from './schemas';

const ACTIVE_INDEX = 'itemIndex';
const ROTATING_INDEX = 'itemIndex_tmp'; // Used when reindexing

type ALLOWED_INDICES = typeof ACTIVE_INDEX | typeof ROTATING_INDEX;

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
  ...Object.values(TagCategory),
];
const FILTERABLE_ATTRIBUTES: (keyof IndexItem)[] = [
  'isPublishedRoot',
  'isHidden',
  'lang',
  'likes',
  'creator',
  ...Object.values(TagCategory),
];
const TYPO_TOLERANCE: TypoTolerance = {
  enabled: true,
  minWordSizeForTypos: {
    oneTypo: 4,
    twoTypos: 6,
  },
};

/*
 * Handle search index business logic with Meilisearch
 * Ideally we try to keep the public method idempotent. You can "delete" unexisting items and indexing work for first indexation and for updates.
 */
export class MeiliSearchWrapper {
  private readonly meilisearchClient: MeiliSearch;
  private readonly indexDictionary: Record<string, Index<IndexItem>> = {};
  private readonly fileService: FileService;
  private readonly logger: BaseLogger;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;
  private readonly itemRepository: ItemRepository;
  private readonly itemPublishedRepository: ItemPublishedRepository;
  private readonly itemTagRepository: ItemTagRepository;
  private readonly itemLikeRepository: ItemLikeRepository;

  constructor(
    meilisearchConnection: MeiliSearch,
    fileService: FileService,
    itemVisibilityRepository: ItemVisibilityRepository,
    itemRepository: ItemRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemTagRepository: ItemTagRepository,
    itemLikeRepository: ItemLikeRepository,
    logger: BaseLogger,
  ) {
    this.meilisearchClient = meilisearchConnection;
    this.fileService = fileService;
    this.itemRepository = itemRepository;
    this.itemVisibilityRepository = itemVisibilityRepository;
    this.itemPublishedRepository = itemPublishedRepository;
    this.itemTagRepository = itemTagRepository;
    this.itemLikeRepository = itemLikeRepository;
    this.logger = logger;

    // create index in the background if it doesn't exist
    this.getIndex();
  }

  private removeHTMLTags(s?: string | null): string {
    if (!s) return '';
    return stripHtml(s);
  }

  private async logTaskCompletion(task: EnqueuedTask, itemName: string) {
    try {
      const finishedTask = await (await this.getIndex()).waitForTask(task.taskUid);
      this.logger.info(
        `Meilisearch ${task.type} task completed (${task.status}): item name => ${itemName}. ${
          finishedTask.error ? `Error: ${finishedTask.error}` : ''
        }`,
      );
    } catch (e) {
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
  private async getIndex(name: ALLOWED_INDICES = ACTIVE_INDEX): Promise<Index<IndexItem>> {
    if (this.indexDictionary[name]) {
      return this.indexDictionary[name];
    }

    try {
      const index = await this.meilisearchClient.getIndex(name);
      this.indexDictionary[name] = index;
      return index;
    } catch (err) {
      if (err instanceof MeiliSearchApiError && err.code === 'index_not_found') {
        const task = await this.meilisearchClient.createIndex(name);
        await this.meilisearchClient.waitForTask(task.taskUid);

        // If main index just got created, rebuild it in the background
        if (name === ACTIVE_INDEX) {
          this.logger.info('Search index just created, rebuilding index...');
          this.rebuildIndex();
        }

        const index = await this.meilisearchClient.getIndex(name);
        this.indexDictionary[name] = index;
        return index;
      }

      throw err;
    }
  }

  // WORKS ONLY FOR PUBLISHED ITEMS
  async search(queries: MultiSearchParams) {
    // type should match schema
    const searchResult = await this.meilisearchClient.multiSearch<Hit>(queries);
    return searchResult;
  }

  private async parseItem(
    item: ItemWithCreator,
    tags: TagRaw[],
    isPublishedRoot: boolean,
    isHidden: boolean,
    likesCount: number,
  ): Promise<Omit<IndexItem, 'publicationUpdatedAt'>> {
    const tagsByCategory = Object.fromEntries(
      Object.values(TagCategory).map((c) => {
        return [c, tags.filter(({ category }) => category === c).map(({ name }) => name)];
      }),
    ) as { [key in TagCategory]: string[] };

    return {
      id: item.id,
      name: item.name,
      creator: {
        id: item.creator?.id ?? '',
        name: item.creator?.name ?? '',
      },
      description: this.removeHTMLTags(item.description),
      type: item.type,
      content: await this.getContent(item),
      isPublishedRoot: isPublishedRoot,
      isHidden: isHidden,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      lang: item.lang,
      likes: likesCount,
      ...tagsByCategory,
    };
  }

  // Retrieve searchable part inside an item
  private async getContent(item: Item) {
    switch (item.type) {
      case ItemType.DOCUMENT:
        return this.removeHTMLTags((item.extra as DocumentItemExtra).document.content); // better way to type extra safely?
      case ItemType.LOCAL_FILE: {
        const localExtra = (item.extra as LocalFileItemExtra).file;
        if (localExtra.mimetype === MimeTypes.PDF) {
          return localExtra.content;
        } else {
          return '';
        }
      }
      case ItemType.S3_FILE: {
        const s3extra = (item.extra as S3FileItemExtra).s3File;
        if (s3extra.mimetype === MimeTypes.PDF) {
          return s3extra.content;
        } else {
          return '';
        }
      }
      default:
        return '';
    }
  }

  async indexOne(
    db: DBConnection,
    itemPublished: ItemPublishedWithItemWithCreator,
    targetIndex: ALLOWED_INDICES = ACTIVE_INDEX,
  ): Promise<EnqueuedTask> {
    return this.index(db, [itemPublished], targetIndex);
  }

  async index(
    db: DBConnection,
    manyItemPublished: ItemPublishedWithItemWithCreator[],
    targetIndex: ALLOWED_INDICES = ACTIVE_INDEX,
  ): Promise<EnqueuedTask> {
    try {
      // Get all descendants from the input items
      let itemsToIndex: {
        isHidden: boolean;
        publicationUpdatedAt: string;
        item: ItemWithCreator;
      }[] = [];
      for (const p of manyItemPublished) {
        const isHidden = await this.itemVisibilityRepository.getManyBelowAndSelf(db, p.item, [
          ItemVisibilityType.Hidden,
        ]);

        itemsToIndex.push({
          publicationUpdatedAt: p.updatedAt.toISOString(),
          item: p.item,
          isHidden: Boolean(isHidden.find((ih) => p.item.path.includes(ih.item.path))),
        });

        const descendants =
          p.item.type === ItemType.FOLDER
            ? await this.itemRepository.getDescendants(db, p.item)
            : [];

        itemsToIndex = itemsToIndex.concat(
          descendants.map((d) => ({
            item: d,
            publicationUpdatedAt: p.updatedAt.toISOString(),
            isHidden: Boolean(isHidden.find((ih) => d.path.includes(ih.item.path))),
          })),
        );
      }

      // Parse all the item into indexable items (containing published state, visibility, content...)

      const documents: IndexItem[] = await Promise.all(
        itemsToIndex.map(async ({ isHidden, publicationUpdatedAt, item: i }) => {
          // Publishing and categories are implicit/inherited on children, we are forced to query the database to check these
          // More efficient way to get this info? Do the db query for all item at once ?
          // This part might slow the app when we index many items or an item with many children.
          const publishedRoot = await this.itemPublishedRepository.getForItem(db, i.path);
          if (!publishedRoot) {
            throw new ItemPublishedNotFound(i.id);
          }

          const tags = await this.itemTagRepository.getByItemId(db, i.id);

          const likesCount = await this.itemLikeRepository.getCountByItemId(db, i.id);

          return {
            ...(await this.parseItem(
              i,
              tags,
              publishedRoot.item.id === i.id,
              isHidden,
              likesCount,
            )),
            publicationUpdatedAt,
          };
        }),
      );
      // Index the resulting documents

      const index = await this.getIndex(targetIndex);
      const indexingTask = await index.addDocuments(documents);
      this.logTaskCompletion(
        indexingTask,
        itemsToIndex
          .slice(0, 30) // Avoid logging too many items
          .map((i) => i.item.name)
          .join(';'),
      );

      return indexingTask;
    } catch (err) {
      this.logger.error('There was a problem adding items to meilisearch ' + err);
      throw err;
    }
  }

  async deleteOne(db: DBConnection, item: Item) {
    try {
      let itemsToIndex = [item];
      if (item.type === ItemType.FOLDER) {
        itemsToIndex = itemsToIndex.concat(
          await this.itemRepository.getDescendants(db, item, { ordered: false }),
        );
      }

      const documentIds = itemsToIndex.map((i) => i.id);
      const indexingTask = await (await this.getIndex()).deleteDocuments(documentIds);
      this.logTaskCompletion(indexingTask, item.name);
    } catch (err) {
      this.logger.error(`There was a problem adding item ${item.id} to meilisearch: ${err}`);
    }
  }

  // Update the PDF that were stored before the indexing feature to add the content in database
  private async storeMissingPdfContent(db: DBConnection) {
    this.logger.info('PDF BACKFILL: Start adding content to PDFs added before the search feature');

    let total = 0;
    let currentPage = 1;
    // Paginate with 1000 items per page
    while (currentPage === 1 || (currentPage - 1) * 1000 < total) {
      const [fileItems, totalCount] = await this.itemRepository.findAndCount(db, {
        where: { type: ItemType.S3_FILE },
        take: 1000,
        skip: (currentPage - 1) * 1000,
        order: {
          createdAt: 'ASC',
        },
      });
      total = totalCount;
      currentPage++;

      this.logger.info(
        `PDF BACKFILL: Page ${currentPage} - ${fileItems.length} items - total count: ${totalCount}`,
      );

      const filteredItems = fileItems.filter((i) => {
        const s3extra = (i.extra as S3FileItemExtra).s3File;
        return s3extra.mimetype === MimeTypes.PDF && s3extra.content === undefined;
      });

      this.logger.info(`PDF BACKFILL: Page contains ${filteredItems.length} PDF to process`);

      for (const item of filteredItems) {
        const s3extra = (item.extra as S3FileItemExtra).s3File;

        // Probably not needed if we download the file only once
        // const MAX_ACCEPTED_SIZE_MB = 20;
        // if (!s3extra.size || s3extra.size / 1_000_000 > MAX_ACCEPTED_SIZE_MB) {
        //   return '';
        // }
        try {
          const url = await this.fileService.getUrl({
            path: s3extra.path,
          });
          const content = await readPdfContent(url);
          await this.itemRepository.updateOne(db, item.id, {
            extra: { [ItemType.S3_FILE]: { content } } as S3FileItemExtra,
          });
        } catch (e) {
          this.logger.error(
            `PDF BACKFILL: error during processing of item ${item.id} : ${item.name} => ${e}`,
          );
        }
      }
    }

    this.logger.info('PDF BACKFILL: Finished adding content to PDFs');
  }

  async updateItem(id: string, properties: Partial<IndexItem>) {
    await this.meilisearchClient.index(ACTIVE_INDEX).updateDocuments([
      {
        id,
        ...properties,
      },
    ]);
  }

  /**
   * Update facet settings for active index
   */
  async updateFacetSettings() {
    // set facetting order to count for tag categories
    await this.meilisearchClient.index(ACTIVE_INDEX).updateFaceting({
      // return max 50 values per facet for facet distribution
      // it is interesting to receive a lot of values for listing
      maxValuesPerFacet: 50,
      sortFacetValuesBy: Object.fromEntries(Object.values(TagCategory).map((c) => [c, 'count'])),
    });
  }

  // to be executed by async job runner when desired
  async rebuildIndex(pageSize: number = 10) {
    if (MEILISEARCH_STORE_LEGACY_PDF_CONTENT) {
      // Backfill needed pdf data - Probably remove this when everything work well after deployment
      await this.storeMissingPdfContent(db);
    }

    this.logger.info('REBUILD INDEX: Starting index rebuild...');
    const tmpIndex = await this.getIndex(ROTATING_INDEX);

    // Delete existing document if any
    this.logger.info('REBUILD INDEX: Cleaning temporary index...');
    await tmpIndex.waitForTask((await tmpIndex.deleteAllDocuments()).taskUid);

    // Update index config
    const updateSettings = await tmpIndex.updateSettings({
      searchableAttributes: SEARCHABLE_ATTRIBUTES,
      displayedAttributes: DISPLAY_ATTRIBUTES,
      filterableAttributes: FILTERABLE_ATTRIBUTES,
      sortableAttributes: SORT_ATTRIBUTES,
      typoTolerance: TYPO_TOLERANCE,
    });
    await tmpIndex.waitForTask(updateSettings.taskUid);

    this.logger.info('REBUILD INDEX: Starting indexation...');

    // Paginate with cursor through DB items (serializable transaction)
    // This is not executed in a HTTP request context so we can't rely on fastify to create a transaction at the controller level
    // SERIALIZABLE because we don't want other transaction to affect this one while it goes through the pages.
    await db.transaction('SERIALIZABLE', async (tx) => {
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
          const task = await this.index(tx, published, ROTATING_INDEX);
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
    });

    // Swap tmp index with actual index
    this.logger.info(`REBUILD INDEX: Swapping indexes...`);
    const swapTask = await this.meilisearchClient.swapIndexes([
      { indexes: [ACTIVE_INDEX, ROTATING_INDEX] },
    ]);
    await this.meilisearchClient.waitForTask(swapTask.taskUid);

    this.logger.info(`REBUILD INDEX: Index rebuild successful!`);

    await this.updateFacetSettings();

    // Retry if the rebuild fail? Or let retry by a Bull task
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
}
