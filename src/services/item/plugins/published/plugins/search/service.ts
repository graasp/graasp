import MeiliSearch, { MultiSearchParams } from 'meilisearch';
import { DataSource } from 'typeorm';

import { FastifyBaseLogger } from 'fastify';

import { Repositories, buildRepositories } from '../../../../../../utils/repositories';
import FileService from '../../../../../file/service';
import { Actor } from '../../../../../member/entities/member';
import ItemService from '../../../../service';
import { ItemCategoryService } from '../../../itemCategory/services/itemCategory';
import { stripHtml } from '../../../validation/utils';
import { ItemPublishedNotFound } from '../../errors';
import { ItemPublishedService } from '../../service';
import { MeiliSearchWrapper } from './meilisearch';

/*
 * Handle search index business logic with Meilisearch
 * Ideally we try to keep the public method idempotent. You can "delete" unexisting items and indexing work for first indexation and for updates.
 */
export class SearchService {
  itemService: ItemService;
  fileService: FileService;
  meilisearchClient: MeiliSearchWrapper;
  db: DataSource;
  constructor(
    itemService: ItemService,
    fileService: FileService,
    itemPublishedService: ItemPublishedService,
    itemCategoryService: ItemCategoryService,
    db: DataSource,
    meilisearchConnection: MeiliSearch,
    logger: FastifyBaseLogger,
  ) {
    this.itemService = itemService;
    this.fileService = fileService;
    this.meilisearchClient = new MeiliSearchWrapper(db, meilisearchConnection, fileService, logger);

    this.registerSearchHooks(
      buildRepositories(),
      itemService,
      itemPublishedService,
      itemCategoryService,
    );
  }

  private removeHTMLTags(s: string): string {
    if (s === null) return '';
    return stripHtml(s);
  }

  // WORKS ONLY FOR PUBLISHED ITEMS
  async search(actor: Actor, repositories: Repositories, queries: MultiSearchParams) {
    const { itemRepository, itemPublishedRepository } = repositories;

    const forcedFilter = 'isHidden = false';
    // User input needs escaping? Or safe to send to meilisearch? WARNING: search currently done with master key, but search is only exposed endpoint
    const updatedQueries = {
      ...queries,
      queries: queries.queries.map((q) => ({
        ...q,
        filter: q.filter ? `(${q.filter}) AND ${forcedFilter}` : forcedFilter,
      })),
    };

    const searchResult = await this.meilisearchClient.search(updatedQueries);

    return searchResult;
  }

  async rebuildIndex() {
    this.meilisearchClient.rebuildIndex();
  }

  private registerSearchHooks(
    repositories: Repositories,
    itemService: ItemService,
    itemPublishedService: ItemPublishedService,
    ItemCategoryService: ItemCategoryService,
  ) {
    // Update index when itemPublished changes ------------------------------------------

    itemPublishedService.hooks.setPostHook('create', async (member, repositories, { item }) => {
      await this.meilisearchClient.indexOne(item, repositories);
    });

    itemPublishedService.hooks.setPostHook('delete', async (member, repositories, { item }) => {
      await this.meilisearchClient.deleteOne(item, repositories);
    });

    //Is the published item deleted automatically when the item is deleted?

    // Update index when item changes ------------------------------------------

    itemService.hooks.setPostHook('create', async (member, repositories, { item: item }) => {
      try {
        // Check if the item is published (or has published parent)
        await repositories.itemPublishedRepository.getForItem(item);

        // update index
        await this.meilisearchClient.indexOne(item, repositories);
      } catch (e) {
        if (e instanceof ItemPublishedNotFound) {
          return;
        } else {
          throw e;
        }
      }
    });

    itemService.hooks.setPostHook('delete', async (member, repositories, { item: item }) => {
      await this.meilisearchClient.deleteOne(item, repositories);
    });

    itemService.hooks.setPostHook('copy', async (member, repositories, { copy: item }) => {
      try {
        // Check if the item is published (or has published parent)
        await repositories.itemPublishedRepository.getForItem(item);

        // update index
        await this.meilisearchClient.indexOne(item, repositories);
      } catch (e) {
        if (e instanceof ItemPublishedNotFound) {
          return;
        } else {
          throw e;
        }
      }
    });

    itemService.hooks.setPostHook('update', async (member, repositories, { item }) => {
      try {
        // Check if the item is published (or has published parent)
        await repositories.itemPublishedRepository.getForItem(item);
        // update index
        await this.meilisearchClient.indexOne(item, repositories);
      } catch (e) {
        if (e instanceof ItemPublishedNotFound) {
          return;
        } else {
          throw e;
        }
      }
    });

    itemService.hooks.setPostHook(
      'move',
      async (member, repositories, { source, destination, updated }) => {
        try {
          // Check if published from moved item up to tree root
          const published = await repositories.itemPublishedRepository.getForItem(updated);
          // destination or moved item is published, we must update the index
          // update index from published
          await this.meilisearchClient.indexOne(published.item, repositories);
        } catch (e) {
          if (e instanceof ItemPublishedNotFound) {
            // nothing published, we must delete if it exists in index
            await this.meilisearchClient.deleteOne(updated, repositories);
          } else {
            throw e;
          }
        }
      },
    );

    // Update index when categories changes ------------------------------------------

    ItemCategoryService.hooks.setPostHook(
      'create',
      async (member, repositories, { itemCategory }) => {
        try {
          // Check if the item is published (or has published parent)
          const published = await repositories.itemPublishedRepository.getForItem(
            itemCategory.item,
          );

          // update item and its children
          await this.meilisearchClient.indexOne(published.item, repositories);
        } catch (e) {
          if (e instanceof ItemPublishedNotFound) {
            return;
          } else {
            throw e;
          }
        }
      },
    );

    ItemCategoryService.hooks.setPostHook(
      'delete',
      async (member, repositories, { itemCategory }) => {
        try {
          // Check if the item is published (or has published parent)
          const published = await repositories.itemPublishedRepository.getForItem(
            itemCategory.item,
          );

          // update item and its children
          await this.meilisearchClient.indexOne(published.item, repositories);
        } catch (e) {
          if (e instanceof ItemPublishedNotFound) {
            return;
          } else {
            throw e;
          }
        }
      },
    );
  }
}
