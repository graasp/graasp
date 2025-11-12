import { v4 } from 'uuid';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MOCK_LOGGER } from '../../../../../../../../test/app.vitest';
import { GRAASPER_CREATOR_ID } from '../../../../../../../utils/config';
import HookManager from '../../../../../../../utils/hook';
import { ItemService } from '../../../../../item.service';
import { ItemThumbnailService } from '../../../../thumbnail/itemThumbnail.service';
import { ItemPublishedService } from '../../itemPublished.service';
import { MeiliSearchWrapper } from './meilisearch';
import { SearchService } from './search.service';

const meilisearchClient = {
  search: vi.fn(async () => {
    return {} as never;
  }),
  getActiveIndexName: vi.fn(() => 'indexname'),
} as unknown as MeiliSearchWrapper;

const searchService = new SearchService(
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hooks: { setPostHook: vi.fn() } as unknown as HookManager<any>,
  } as ItemService,
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hooks: { setPostHook: vi.fn() } as unknown as HookManager<any>,
  } as ItemPublishedService,
  meilisearchClient,
  { getUrlsByItems: vi.fn() } as unknown as ItemThumbnailService,
  MOCK_LOGGER,
);

describe('search', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  it('filter by tags', async () => {
    const MOCK_RESULT = { hits: [] } as never;
    const spy = vi.spyOn(meilisearchClient, 'search').mockResolvedValue({ results: [MOCK_RESULT] });

    const results = await searchService.search({
      tags: {
        discipline: ['fiction', 'hello'],
        level: ['secondary school', "tag:'hello'"],
        'resource-type': ['type'],
      },
    });
    expect(results).toEqual(MOCK_RESULT);

    const { filter } = spy.mock.calls[0][0].queries[0];
    expect(filter).toContain("discipline IN ['fiction','hello']");
    expect(filter).toContain("level IN ['secondary school','tag:\\'hello\\'']");
    expect(filter).toContain("resource-type IN ['type']");
    expect(filter).toContain('isHidden = false');
  });
  it('filter by langs', async () => {
    const MOCK_RESULT = { hits: [] } as never;
    const spy = vi.spyOn(meilisearchClient, 'search').mockResolvedValue({ results: [MOCK_RESULT] });

    const results = await searchService.search({
      langs: ['fr', 'en'],
    });
    expect(results).toEqual(MOCK_RESULT);

    const { filter } = spy.mock.calls[0][0].queries[0];
    expect(filter).toContain('lang IN [fr,en]');
    expect(filter).toContain('isHidden = false');
  });
  it('filter by published root', async () => {
    const MOCK_RESULT = { hits: [] } as never;
    const spy = vi.spyOn(meilisearchClient, 'search').mockResolvedValue({ results: [MOCK_RESULT] });

    const results = await searchService.search({
      isPublishedRoot: true,
    });
    expect(results).toEqual(MOCK_RESULT);

    const { filter } = spy.mock.calls[0][0].queries[0];
    expect(filter).toContain('isPublishedRoot = true');
    expect(filter).toContain('isHidden = false');
  });
  it('filter by query', async () => {
    const MOCK_RESULT = { hits: [] } as never;
    const spy = vi.spyOn(meilisearchClient, 'search').mockResolvedValue({ results: [MOCK_RESULT] });

    const results = await searchService.search({
      query: 'hello',
    });
    expect(results).toEqual(MOCK_RESULT);

    const { q } = spy.mock.calls[0][0].queries[0];
    expect(q).toEqual('hello');
  });
  it('filter by creator id', async () => {
    const MOCK_RESULT = { hits: [] } as never;
    const spy = vi.spyOn(meilisearchClient, 'search').mockResolvedValue({ results: [MOCK_RESULT] });

    const creatorId = v4();
    const results = await searchService.search({
      creatorId,
    });
    expect(results).toEqual(MOCK_RESULT);

    const { filter } = spy.mock.calls[0][0].queries[0];
    expect(filter).toContain(`creator.id = '${creatorId}'`);
  });
  it('apply sort', async () => {
    const MOCK_RESULT = { hits: [] } as never;
    const spy = vi.spyOn(meilisearchClient, 'search').mockResolvedValue({ results: [MOCK_RESULT] });

    const results = await searchService.search({
      sort: ['likes:desc'],
    });
    expect(results).toEqual(MOCK_RESULT);

    const { sort } = spy.mock.calls[0][0].queries[0];
    expect(sort).toEqual(['likes:desc']);
  });
});

describe('getMostLiked', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  it('apply sort by likes', async () => {
    const MOCK_RESULT = { hits: [] } as never;
    const spy = vi.spyOn(meilisearchClient, 'search').mockResolvedValue({ results: [MOCK_RESULT] });

    const results = await searchService.getMostLiked(4);
    expect(results).toEqual(MOCK_RESULT);

    const { sort, limit } = spy.mock.calls[0][0].queries[0];
    expect(sort).toEqual(['likes:desc']);
    expect(limit).toEqual(4);
  });
});

describe('getMostRecent', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  it('apply sort by publication updatedAt', async () => {
    const MOCK_RESULT = { hits: [] } as never;
    const spy = vi.spyOn(meilisearchClient, 'search').mockResolvedValue({ results: [MOCK_RESULT] });

    const results = await searchService.getMostRecent(4);
    expect(results).toEqual(MOCK_RESULT);

    const { sort, limit } = spy.mock.calls[0][0].queries[0];
    expect(sort).toEqual(['publicationUpdatedAt:desc']);
    expect(limit).toEqual(4);
  });
});

describe('getFeatured', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  it('apply creator and sort by publication updatedAt', async () => {
    const MOCK_RESULT = { hits: [] } as never;
    const spy = vi.spyOn(meilisearchClient, 'search').mockResolvedValue({ results: [MOCK_RESULT] });
    const serviceSpy = vi.spyOn(searchService, 'search');

    const results = await searchService.getFeatured(GRAASPER_CREATOR_ID, 4);
    expect(results).toEqual(MOCK_RESULT);

    // verify the arguments passed to the search function inside the service
    const { creatorId } = serviceSpy.mock.calls[0][0];
    expect(creatorId).toEqual(GRAASPER_CREATOR_ID);
    // verify arguments passed to the meilisearch API
    const { sort, hitsPerPage } = spy.mock.calls[0][0].queries[0];
    expect(sort).toEqual(['name:asc']);
    expect(hitsPerPage).toEqual(4);
  });
});

describe('getFacets', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  it('filter by tags', async () => {
    const MOCK_RESULT = {
      indexUid: 'index',
      hits: [],
      facetDistribution: { lang: { en: 1 } },
      processingTimeMs: 1,
      query: '',
    };
    const spy = vi
      .spyOn(meilisearchClient, 'search')
      .mockResolvedValue({ results: [MOCK_RESULT as never] });

    const results = await searchService.getFacets('lang', {
      tags: {
        discipline: ['fiction', 'hello'],
        level: ['secondary school', "aujourd'hui"],
        'resource-type': ['type'],
      },
    });
    expect(results).toEqual(MOCK_RESULT.facetDistribution.lang);

    const { filter } = spy.mock.calls[0][0].queries[0];
    expect(filter).toContain("discipline IN ['fiction','hello']");
    expect(filter).toContain("level IN ['secondary school','aujourd\\'hui']");
    expect(filter).toContain("resource-type IN ['type']");
  });
  it('filter by langs', async () => {
    const MOCK_RESULT = {
      indexUid: 'index',
      hits: [],
      facetDistribution: { lang: { en: 1 } },
      processingTimeMs: 1,
      query: '',
    };
    const spy = vi.spyOn(meilisearchClient, 'search').mockResolvedValue({ results: [MOCK_RESULT] });

    const results = await searchService.getFacets('lang', {
      langs: ['fr', 'en'],
    });
    expect(results).toEqual(MOCK_RESULT.facetDistribution.lang);

    const { filter } = spy.mock.calls[0][0].queries[0];
    expect(filter).toContain('lang IN [fr,en]');
  });
  it('filter by published root', async () => {
    const MOCK_RESULT = {
      indexUid: 'index',
      hits: [],
      facetDistribution: { lang: { en: 1 } },
      processingTimeMs: 1,
      query: '',
    };
    const spy = vi.spyOn(meilisearchClient, 'search').mockResolvedValue({ results: [MOCK_RESULT] });

    const results = await searchService.getFacets('lang', {
      isPublishedRoot: true,
    });
    expect(results).toEqual(MOCK_RESULT.facetDistribution.lang);

    const { filter } = spy.mock.calls[0][0].queries[0];
    expect(filter).toContain('isPublishedRoot = true');
  });
  it('filter by query', async () => {
    const MOCK_RESULT = {
      indexUid: 'index',
      hits: [],
      facetDistribution: { lang: { en: 1 } },
      processingTimeMs: 1,
      query: '',
    };
    const spy = vi.spyOn(meilisearchClient, 'search').mockResolvedValue({ results: [MOCK_RESULT] });

    const results = await searchService.getFacets('lang', {
      query: 'hello',
    });
    expect(results).toEqual(MOCK_RESULT.facetDistribution.lang);

    const { q } = spy.mock.calls[0][0].queries[0];
    expect(q).toEqual('hello');
  });
});
