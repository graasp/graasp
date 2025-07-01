import { Queue } from 'bullmq';
import { SQL, count, eq } from 'drizzle-orm';
import {
  EnqueuedTask,
  Index,
  MeiliSearch,
  MeiliSearchApiError,
  type MultiSearchParams,
} from 'meilisearch';
import { singleton } from 'tsyringe';

import {
  type IndexItem,
  ItemType,
  ItemVisibilityType,
  MimeTypes,
  TagCategory,
  type TagCategoryType,
} from '@graasp/sdk';

import { REDIS_CONNECTION } from '../../../../../../../config/redis';
import { type DBConnection } from '../../../../../../../drizzle/db';
import { items } from '../../../../../../../drizzle/schema';
import type {
  ItemPublishedWithItemWithCreator,
  ItemRaw,
  ItemTypeEnumKeys,
  ItemWithCreator,
  TagRaw,
} from '../../../../../../../drizzle/types';
import { BaseLogger } from '../../../../../../../logger';
import { Queues } from '../../../../../../../workers/config';
import { isItemType } from '../../../../../discrimination';
import { ItemRepository } from '../../../../../item.repository';
import { ItemLikeRepository } from '../../../../itemLike/itemLike.repository';
import { ItemVisibilityRepository } from '../../../../itemVisibility/itemVisibility.repository';
import { ItemTagRepository } from '../../../../tag/ItemTag.repository';
import { stripHtml } from '../../../validation/utils';
import { ItemPublishedNotFound } from '../../errors';
import { ItemPublishedRepository } from '../../itemPublished.repository';
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
  private readonly itemVisibilityRepository: ItemVisibilityRepository;
  private readonly itemRepository: ItemRepository;
  private readonly itemPublishedRepository: ItemPublishedRepository;
  private readonly itemTagRepository: ItemTagRepository;
  private readonly itemLikeRepository: ItemLikeRepository;
  private readonly searchQueue: Queue;

  constructor(
    meilisearchConnection: MeiliSearch,
    itemVisibilityRepository: ItemVisibilityRepository,
    itemRepository: ItemRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemTagRepository: ItemTagRepository,
    itemLikeRepository: ItemLikeRepository,
    logger: BaseLogger,
  ) {
    this.meilisearchClient = meilisearchConnection;
    this.itemRepository = itemRepository;
    this.itemVisibilityRepository = itemVisibilityRepository;
    this.itemPublishedRepository = itemPublishedRepository;
    this.itemTagRepository = itemTagRepository;
    this.itemLikeRepository = itemLikeRepository;
    this.logger = logger;

    this.searchQueue = new Queue(Queues.SearchIndex.queueName, {
      connection: { url: REDIS_CONNECTION },
    });

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
    ) as { [key in TagCategoryType]: string[] };

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
  private async getContent(item: ItemRaw) {
    switch (true) {
      case isItemType(item, ItemType.DOCUMENT):
        return this.removeHTMLTags(item.extra.document.content); // better way to type extra safely?
      case isItemType(item, ItemType.FILE): {
        const localExtra = item.extra.file;
        if (localExtra.mimetype === MimeTypes.PDF) {
          return localExtra.content;
        } else {
          return '';
        }
      }
      default:
        return '';
    }
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
  ): Promise<EnqueuedTask> {
    try {
      // Get all descendants from the input items
      let itemsToIndex: {
        isHidden: boolean;
        publicationUpdatedAt: string;
        item: ItemWithCreator;
      }[] = [];
      for (const p of manyItemPublished) {
        const isHidden = await this.itemVisibilityRepository.getManyBelowAndSelf(
          dbConnection,
          p.item,
          [ItemVisibilityType.Hidden],
        );

        itemsToIndex.push({
          publicationUpdatedAt: p.updatedAt,
          item: p.item,
          isHidden: Boolean(isHidden.find((ih) => p.item.path.includes(ih.item.path))),
        });

        const descendants = isItemType(p.item, ItemType.FOLDER)
          ? await this.itemRepository.getDescendants(dbConnection, p.item)
          : [];

        itemsToIndex = itemsToIndex.concat(
          descendants.map((d) => ({
            item: d,
            publicationUpdatedAt: p.updatedAt,
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
          const publishedRoot = await this.itemPublishedRepository.getForItem(dbConnection, i.path);
          if (!publishedRoot) {
            throw new ItemPublishedNotFound(i.id);
          }

          const tags = await this.itemTagRepository.getByItemId(dbConnection, i.id);

          const likesCount = await this.itemLikeRepository.getCountByItemId(dbConnection, i.id);

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

  async deleteOne(dbConnection: DBConnection, item: ItemRaw) {
    try {
      let itemsToIndex = [item];
      if (isItemType(item, ItemType.FOLDER)) {
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
    args: { where: { type: ItemTypeEnumKeys }; take: number; skip: number; order: SQL },
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
