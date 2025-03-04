import { MultiSearchQuery } from 'meilisearch';
import { singleton } from 'tsyringe';

import { TagCategory, UUID } from '@graasp/sdk';

import { Tag } from '../../../../../../../drizzle/schema';
import { BaseLogger } from '../../../../../../../logger';
import {
  GET_MOST_LIKED_ITEMS_MAXIMUM,
  GET_MOST_RECENT_ITEMS_MAXIMUM,
} from '../../../../../../../utils/config';
import { ItemService } from '../../../../../service';
import { ItemPublishedRepository } from '../../repositories/itemPublished';
import { ItemPublishedService } from '../../service';
import { MeiliSearchWrapper } from './meilisearch';

type SearchFilters = Partial<{
  query?: string;
  tags: Partial<{ [key in TagCategory]: Tag['name'][] }>;
  langs: string[];
  isPublishedRoot: boolean;
  creatorId?: UUID;
}>;

/*
 * Handle search index business logic with Meilisearch
 * Ideally we try to keep the public method idempotent. You can "delete" unexisting items and indexing work for first indexation and for updates.
 */
@singleton()
export class SearchService {
  private readonly meilisearchClient: MeiliSearchWrapper;
  private readonly logger: BaseLogger;
  private readonly itemPublishedRepository: ItemPublishedRepository;

  constructor(
    itemService: ItemService,
    itemPublishedService: ItemPublishedService,
    meilisearchClient: MeiliSearchWrapper,
    itemPublishedRepository: ItemPublishedRepository,
    logger: BaseLogger,
  ) {
    this.meilisearchClient = meilisearchClient;
    this.logger = logger;
    this.itemPublishedRepository = itemPublishedRepository;
    this.registerSearchHooks(itemService, itemPublishedService);
  }

  async getHealth() {
    return this.meilisearchClient.getHealth();
  }

  // User input needs escaping? Or safe to send to meilisearch? WARNING: search currently done with master key, but search is only exposed endpoint
  private buildFilters({ tags, langs = [], isPublishedRoot = true, creatorId }: SearchFilters) {
    // tags
    const tagCategoryFilters = Object.values(TagCategory).map((c) => {
      // escape quotes used for building the filter
      return tags?.[c]?.length
        ? `${c} IN [${tags?.[c].map((t) => `'${t.replace(/'/g, "\\'")}'`).join(',')}]`
        : '';
    });

    // is published root
    const isPublishedFilter = isPublishedRoot ? `isPublishedRoot = ${isPublishedRoot}` : '';

    // creator id
    const creatorIdFilter = creatorId ? `creator.id = '${creatorId}'` : '';

    // langs
    const langsFilter = langs.length ? `lang IN [${langs.join(',')}]` : '';

    const filters = [
      ...tagCategoryFilters,
      isPublishedFilter,
      langsFilter,
      creatorIdFilter,
      'isHidden = false',
    ]
      .filter(Boolean)
      .join(' AND ');

    return filters;
  }

  async getMostLiked(limit: number = GET_MOST_LIKED_ITEMS_MAXIMUM) {
    return await this.search({ sort: ['likes:desc'], limit });
  }

  async getMostRecent(limit: number = GET_MOST_RECENT_ITEMS_MAXIMUM) {
    return await this.search({ sort: ['publicationUpdatedAt:desc'], limit });
  }

  async search(body: Omit<MultiSearchQuery, 'filter' | 'indexUid' | 'q'> & SearchFilters) {
    const { tags, langs, isPublishedRoot, query, creatorId, ...q } = body;
    const filters = this.buildFilters({
      creatorId,
      tags,
      langs,
      isPublishedRoot,
    });

    // User input needs escaping? Or safe to send to meilisearch? WARNING: search currently done with master key, but search is only exposed endpoint
    const updatedQueries = {
      queries: [
        {
          indexUid: this.meilisearchClient.getActiveIndexName(),
          attributesToHighlight: ['*'],
          ...q,
          q: query,
          filter: filters,
        },
      ],
    };

    const searchResult = await this.meilisearchClient.search(updatedQueries);
    return searchResult.results[0];
  }

  async getFacets(facetName: string, body: SearchFilters & Pick<MultiSearchQuery, 'facets'>) {
    const { langs, isPublishedRoot, query, tags } = body;
    const filters = this.buildFilters({
      tags,
      langs,
      isPublishedRoot,
    });
    // User input needs escaping? Or safe to send to meilisearch? WARNING: search currently done with master key, but search is only exposed endpoint
    const updatedQueries = {
      queries: [
        {
          indexUid: this.meilisearchClient.getActiveIndexName(),
          facets: [facetName],
          q: query,
          filter: filters,
        },
      ],
    };

    const searchResult = await this.meilisearchClient.search(updatedQueries);
    return searchResult.results[0].facetDistribution?.[facetName] ?? {};
  }

  async rebuildIndex() {
    this.meilisearchClient.rebuildIndex();
  }

  // Registers all hooks related to sync between database and meilisearch index
  // Make sure to not throw if indexation fail, so that the app can continue to work if Meilisearch is down.
  private registerSearchHooks(
    itemService: ItemService,
    itemPublishedService: ItemPublishedService,
  ) {
    // Update index when itemPublished changes ------------------------------------------

    itemPublishedService.hooks.setPostHook('delete', async (member, db, { item }) => {
      try {
        await this.meilisearchClient.deleteOne(db, item);
      } catch {
        this.logger.error('Error during indexation, Meilisearch may be down');
      }
    });

    //Is the published item deleted automatically when the item is deleted?

    // Update index when item changes ------------------------------------------

    itemService.hooks.setPostHook('create', async (member, db, { item }) => {
      try {
        // Check if the item is published (or has published parent)
        const published = await this.itemPublishedRepository.getForItem(db, item.path);

        if (!published) {
          return;
        }

        // update index
        await this.meilisearchClient.indexOne(db, published);
      } catch (e) {
        this.logger.error('Error during indexation, Meilisearch may be down');
      }
    });

    itemService.hooks.setPostHook('delete', async (member, db, { item }) => {
      try {
        await this.meilisearchClient.deleteOne(db, item);
      } catch {
        this.logger.error('Error during indexation, Meilisearch may be down');
      }
    });

    itemService.hooks.setPostHook('update', async (member, db, { item }) => {
      try {
        // Check if the item is published (or has published parent)
        const published = await this.itemPublishedRepository.getForItem(db, item);

        if (!published) {
          return;
        }
        // update index
        await this.meilisearchClient.indexOne(db, published);
      } catch (e) {
        this.logger.error('Error during indexation, Meilisearch may be down');
      }
    });

    itemService.hooks.setPostHook('move', async (member, db, { destination }) => {
      try {
        // Check if published from moved item up to tree root
        const published = await this.itemPublishedRepository.getForItem(db, destination.path);

        if (published) {
          // destination or moved item is published, we must update the index
          // update index from published
          await this.meilisearchClient.indexOne(db, published);
        } else {
          // nothing published, we must delete if it exists in index
          await this.meilisearchClient.deleteOne(db, destination);
        }
      } catch (e) {
        this.logger.error('Error during indexation, Meilisearch may be down');
      }
    });
  }
}
