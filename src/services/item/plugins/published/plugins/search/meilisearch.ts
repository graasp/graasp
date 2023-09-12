import MeiliSearch, {
  EnqueuedTask,
  Index,
  MeiliSearchApiError,
  MultiSearchParams,
  TaskStatus,
  TypoTolerance,
} from 'meilisearch';
import { DataSource, In } from 'typeorm';

import { FastifyBaseLogger } from 'fastify';

import {
  DocumentItemExtra,
  ItemTagType,
  ItemType,
  LocalFileItemExtra,
  MimeTypes,
  S3FileItemExtra,
} from '@graasp/sdk';

import { FILE_STORAGE_ROOT_PATH } from '../../../../../../utils/config';
import { Repositories, buildRepositories } from '../../../../../../utils/repositories';
import FileService from '../../../../../file/service';
import { Item } from '../../../../entities/Item';
import { readPdfContent } from '../../../../utils';
import { stripHtml } from '../../../validation/utils';
import { ItemPublishedRepository } from '../../repositories/itemPublished';

const ACTIVE_INDEX = 'itemIndex';
const ROTATING_INDEX = 'itemIndex_tmp'; // Used when reindexing

type ALLOWED_INDICES = typeof ACTIVE_INDEX | typeof ROTATING_INDEX;

// Make index configuration typesafe
const SEARCHABLE_ATTRIBUTES: (keyof IndexItem)[] = ['name', 'description', 'content', 'creator'];
const SORT_ATTRIBUTES: (keyof IndexItem)[] = ['name', 'updatedAt', 'createdAt'];
const DISPLAY_ATTRIBUTES: (keyof IndexItem)[] = [
  'id',
  'name',
  'creator',
  'description',
  'type',
  'content',
  'createdAt',
  'updatedAt',
  'categories',
  'isPublishedRoot',
  'isHidden',
];
const FILTERABLE_ATTRIBUTES: (keyof IndexItem)[] = ['categories', 'isPublishedRoot', 'isHidden'];
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
  private meilisearchClient: MeiliSearch;
  indexDictionary: Record<string, Index<IndexItem>> = {};
  fileService: FileService;
  db: DataSource;
  logger: FastifyBaseLogger;
  constructor(
    db: DataSource,
    meilisearchConnection: MeiliSearch,
    fileService: FileService,
    logger: FastifyBaseLogger,
  ) {
    this.meilisearchClient = meilisearchConnection;
    this.fileService = fileService;
    this.db = db;
    this.logger = logger;

    // create index in the background if it doesn't exist
    this.getIndex();
  }

  private removeHTMLTags(s: string): string {
    if (s === null) return '';
    return stripHtml(s);
  }

  private async logTaskCompletion(task: EnqueuedTask, itemName: string) {
    const finishedTask = await (await this.getIndex()).waitForTask(task.taskUid);
    if (task.status === TaskStatus.TASK_SUCCEEDED) {
      this.logger.info(
        `Meilisearch task completed: item name => ${itemName}, task type => ${task.type}, result: Successful task`,
      );
    } else {
      this.logger.info(
        `Meilisearch task completed: item name => ${itemName}, task type => ${task.type}, result: ${finishedTask.error}`,
      );
    }
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
    const searchResult = await this.meilisearchClient.multiSearch(queries, {
      hitsPerPage: 5,
      attributesToHighlight: ['*'],
    });

    return searchResult;
  }

  private async parseItem(
    item: Item,
    categories: string[],
    isPublishedRoot: boolean,
    isHidden: boolean,
  ): Promise<IndexItem> {
    return {
      id: item.id,
      name: item.name,
      creator: {
        id: item.creator?.id ?? '',
        name: item.creator?.name ?? '',
      },
      description: this.removeHTMLTags(item.description),
      type: item.type,
      categories: categories,
      content: await this.getContent(item),
      isPublishedRoot: isPublishedRoot,
      isHidden: isHidden,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  // Retrieve searchable part inside an item
  private async getContent(item: Item) {
    switch (item.type) {
      case ItemType.DOCUMENT:
        return this.removeHTMLTags((item.extra as DocumentItemExtra).document.content); // better way to type extra safely?
      case ItemType.LOCAL_FILE:
        const localExtra = (item.extra as LocalFileItemExtra).file;
        if (localExtra.mimetype === MimeTypes.PDF) {
          return localExtra.content;
        } else {
          return '';
        }
      case ItemType.S3_FILE:
        const s3extra = (item.extra as S3FileItemExtra).s3File;
        if (s3extra.mimetype === MimeTypes.PDF) {
          return s3extra.content;
        } else {
          return '';
        }
      default:
        return '';
    }
  }

  async indexOne(
    item: Item,
    repositories: Repositories,
    targetIndex: ALLOWED_INDICES = ACTIVE_INDEX,
  ): Promise<EnqueuedTask> {
    return this.index([item], repositories, targetIndex);
  }

  async index(
    items: Item[],
    repositories: Repositories,
    targetIndex: ALLOWED_INDICES = ACTIVE_INDEX,
  ): Promise<EnqueuedTask> {
    try {
      // Get all descendants from the input items
      const itemsToIndex: Item[] = [...items];
      itemsToIndex.push(
        ...(await repositories.itemRepository.getManyDescendants(
          items.filter((i) => i.type === ItemType.FOLDER),
        )),
      );

      // Parse all the item into indexable items (containing published state, tag, content...)

      const isHidden = await repositories.itemTagRepository.hasForMany(
        itemsToIndex,
        ItemTagType.Hidden,
      );

      const documents = await Promise.all(
        itemsToIndex.map(async (i) => {
          // Publishing and categories are implicit/inherited on children, we are forced to query the database to check these
          // More efficient way to get this info? Do the db query for all item at once ?
          // This part might slow the app when we index many items or an item with many children.
          const publishedRoot = await repositories.itemPublishedRepository.getForItem(i);
          const categories = (await repositories.itemCategoryRepository.getForItemOrParent(i)).map(
            (ic) => ic.category.id,
          );

          return await this.parseItem(
            i,
            Array.from(new Set(categories)),
            publishedRoot.item.id === i.id,
            isHidden.data[i.id] ?? false,
          );
        }),
      );

      // Index the resulting documents

      const index = await this.getIndex(targetIndex);
      const indexingTask = await index.addDocuments(documents);
      this.logTaskCompletion(indexingTask, items.map((i) => i.name).join(';'));

      return indexingTask;
    } catch (err) {
      this.logger.error('There was a problem adding items to meilisearch ' + err);
      throw err;
    }
  }

  async deleteOne(item: Item, repositories: Repositories) {
    try {
      let itemsToIndex = [item];
      if (item.type === ItemType.FOLDER) {
        itemsToIndex = itemsToIndex.concat(await repositories.itemRepository.getDescendants(item));
      }

      const documentIds = itemsToIndex.map((i) => i.id);
      const indexingTask = await (await this.getIndex()).deleteDocuments(documentIds);
      this.logTaskCompletion(indexingTask, item.name);
    } catch (err) {
      this.logger.error(`There was a problem adding item ${item.id} to meilisearch: ${err}`);
    }
  }

  // Update the PDF that were stored before the indexing feature to add the content in database
  private async storeMissingPdfContent(repositories: Repositories) {
    this.logger.info('Start adding content to PDFs added before the search feature');
    // We could theorically directly request the item where 'content' doesn't exist, but 'content' being inside the JSON in two different extra types makes it a bit of a pain.
    const fileItems = await repositories.itemRepository.find({
      where: { type: In([ItemType.LOCAL_FILE, ItemType.S3_FILE]) },
    });

    for (const item of fileItems) {
      if (item.type === ItemType.LOCAL_FILE) {
        const localExtra = (item.extra as LocalFileItemExtra).file;
        if (localExtra.mimetype === MimeTypes.PDF && localExtra.content === undefined) {
          const content =
            (await readPdfContent(`${FILE_STORAGE_ROOT_PATH}/${localExtra.path}`)) ?? '';
          await repositories.itemRepository.patch(item.id, {
            extra: { [ItemType.LOCAL_FILE]: { content } } as LocalFileItemExtra,
          });
        }
      } else if (item.type === ItemType.S3_FILE) {
        const s3extra = (item.extra as S3FileItemExtra).s3File;

        // Probably not needed if we download the file only once
        // const MAX_ACCEPTED_SIZE_MB = 20;
        // if (!s3extra.size || s3extra.size / 1_000_000 > MAX_ACCEPTED_SIZE_MB) {
        //   return '';
        // }
        if (s3extra.mimetype === MimeTypes.PDF && s3extra.content === undefined) {
          const url = (await this.fileService.download(undefined, {
            id: item.id,
            path: s3extra.path,
            replyUrl: true,
          })) as string;
          const content = await readPdfContent(url);
          await repositories.itemRepository.patch(item.id, {
            extra: { [ItemType.S3_FILE]: { content } } as S3FileItemExtra,
          });
        }
      }
    }
    this.logger.info('Finished adding content to PDFs');
  }

  // to be executed by async job runner when desired
  async rebuildIndex(pageSize: number = 20) {
    // Backfill needed pdf data - Probably remove this when everything work well after deployment
    await this.storeMissingPdfContent(buildRepositories());

    this.logger.info('Starting index rebuild...');
    const tmpIndex = await this.getIndex(ROTATING_INDEX);

    // Delete existing document if any
    this.logger.info('Cleaning temporary index...');
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

    this.logger.info('Starting indexation...');

    // Paginate with cursor through DB items (serializable transaction)
    // This is not executed in a HTTP request context so we can't rely on fastify to create a transaction at the controller level
    // SERIALIZABLE because we don't want other transaction to affect this one while it goes through the pages.
    await this.db.transaction('SERIALIZABLE', async (manager) => {
      const tasks: EnqueuedTask[] = [];

      let currentPage = 1;
      let total = 0;
      while (currentPage === 1 || (currentPage - 1) * pageSize < total) {
        // Retrieve a page (i.e. 20 items)
        const [published, totalCount] = await manager
          .withRepository(ItemPublishedRepository)
          .getPaginatedItems(currentPage, pageSize);
        this.logger.info(
          `Page ${currentPage} - ${published.length} items - total count: ${totalCount}`,
        );
        total = totalCount;
        currentPage++;

        // Index items (1 task per page)
        this.logger.info('Pushing indexing tasks...');
        tasks.push(
          await this.index(
            published.map((p) => p.item),
            buildRepositories(manager),
            ROTATING_INDEX,
          ),
        );
      }
      this.logger.info(`Waiting for ${tasks.length} tasks to terminate...`);
      // Wait to be sure that everything is indexed
      await tmpIndex.waitForTasks(tasks.map((t) => t.taskUid));
    });

    // Swap tmp index with actual index
    this.logger.info(`Swapping indexes...`);
    const swapTask = await this.meilisearchClient.swapIndexes([
      { indexes: [ACTIVE_INDEX, ROTATING_INDEX] },
    ]);
    await this.meilisearchClient.waitForTask(swapTask.taskUid);

    this.logger.info(`Index rebuild successful!`);

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
}

export type IndexItem = {
  id: string;
  name: string;
  creator: IndexMember;
  description: string;
  type: `${ItemType}`;
  categories: string[];
  content: string;
  isPublishedRoot: boolean;
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type IndexMember = {
  id: string;
  name: string;
};
