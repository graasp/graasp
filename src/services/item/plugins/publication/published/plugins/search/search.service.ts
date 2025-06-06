import type { MultiSearchQuery } from 'meilisearch';
import { singleton } from 'tsyringe';

import { TagCategory, type TagCategoryType, type UUID } from '@graasp/sdk';

import type { TagRaw } from '../../../../../../../drizzle/types';
import { BaseLogger } from '../../../../../../../logger';
import {
  GET_FEATURED_ITEMS_MAXIMUM,
  GET_MOST_LIKED_ITEMS_MAXIMUM,
  GET_MOST_RECENT_ITEMS_MAXIMUM,
} from '../../../../../../../utils/config';
import { ItemService } from '../../../../../item.service';
import { ItemPublishedService } from '../../itemPublished.service';
import { MeiliSearchWrapper } from './meilisearch';

type SearchFilters = Partial<{
  query?: string;
  tags: Partial<{ [key in TagCategoryType]: TagRaw['name'][] }>;
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

  constructor(
    itemService: ItemService,
    itemPublishedService: ItemPublishedService,
    meilisearchClient: MeiliSearchWrapper,
    logger: BaseLogger,
  ) {
    this.meilisearchClient = meilisearchClient;
    this.logger = logger;
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

  async getFeatured(creatorId: string, limit: number = GET_FEATURED_ITEMS_MAXIMUM) {
    return await this.search({
      creatorId,
      hitsPerPage: limit,
      // order by most recently updated first
      sort: ['name:asc'],
      // only include top level content
      isPublishedRoot: true,
    });
  }

  async getMostLiked(limit: number = GET_MOST_LIKED_ITEMS_MAXIMUM) {
    return await this.search({ sort: ['likes:desc'], limit });
  }

  async getMostRecent(limit: number = GET_MOST_RECENT_ITEMS_MAXIMUM) {
    return await this.search({ sort: ['publicationUpdatedAt:desc'], limit });
  }

  async search(body: Omit<MultiSearchQuery, 'filter' | 'indexUid' | 'q'> & SearchFilters) {
    const { tags, langs, isPublishedRoot, query, creatorId, limit, page, ...q } = body;
    // should allways use pagination arguments together
    // page + hitsPerPage
    // limit + offset
    if (limit && page) {
      throw new Error(
        "'page' used together with 'limit'. Use 'page' in combination with 'hitsPerPage'. Otherwise use 'limit' with 'offset'. For more information see: https://www.meilisearch.com/docs/guides/front_end/pagination",
      );
    }

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
          limit,
          page,
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
  }
}
