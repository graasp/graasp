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
  logger: FastifyBaseLogger;
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
    this.logger = logger;
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

  async getHealth() {
    return this.meilisearchClient.getHealth();
  }

  // WORKS ONLY FOR PUBLISHED ITEMS
  async search(_actor: Actor, _repositories: Repositories, queries: MultiSearchParams) {
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

  // Registers all hooks related to sync between database and meilisearch index
  // Make sure to not throw if indexation fail, so that the app can continue to work if Meilisearch is down.
  private registerSearchHooks(
    repositories: Repositories,
    itemService: ItemService,
    itemPublishedService: ItemPublishedService,
    ItemCategoryService: ItemCategoryService,
  ) {
    // Update index when itemPublished changes ------------------------------------------

    itemPublishedService.hooks.setPostHook('create', async (member, repositories, { item }) => {
      try {
        await this.meilisearchClient.indexOne(item, repositories);
      } catch {
        this.logger.error('Error during indexation, Meilisearch may be down');
      }
    });

    itemPublishedService.hooks.setPostHook('delete', async (member, repositories, { item }) => {
      try {
        await this.meilisearchClient.deleteOne(item, repositories);
      } catch {
        this.logger.error('Error during indexation, Meilisearch may be down');
      }
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
          this.logger.error('Error during indexation, Meilisearch may be down');
        }
      }
    });

    itemService.hooks.setPostHook('delete', async (member, repositories, { item: item }) => {
      try {
        await this.meilisearchClient.deleteOne(item, repositories);
      } catch {
        this.logger.error('Error during indexation, Meilisearch may be down');
      }
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
          this.logger.error('Error during indexation, Meilisearch may be down');
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
          this.logger.error('Error during indexation, Meilisearch may be down');
        }
      }
    });

    itemService.hooks.setPostHook('move', async (member, repositories, { destination }) => {
      try {
        // Check if published from moved item up to tree root
        const published = await repositories.itemPublishedRepository.getForItem(destination);
        // destination or moved item is published, we must update the index
        // update index from published
        await this.meilisearchClient.indexOne(published.item, repositories);
      } catch (e) {
        if (e instanceof ItemPublishedNotFound) {
          // nothing published, we must delete if it exists in index
          await this.meilisearchClient.deleteOne(destination, repositories);
        } else {
          this.logger.error('Error during indexation, Meilisearch may be down');
        }
      }
    });

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
            this.logger.error('Error during indexation, Meilisearch may be down');
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
            this.logger.error('Error during indexation, Meilisearch may be down');
          }
        }
      },
    );
  }
}
