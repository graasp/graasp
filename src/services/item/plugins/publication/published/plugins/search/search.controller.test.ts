import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import type { MultiSearchParams } from 'meilisearch';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, PermissionLevel, TagCategory } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../../../test/app';
import { seedFromJson } from '../../../../../../../../test/mocks/seed';
import { db } from '../../../../../../../drizzle/db';
import { itemsRawTable } from '../../../../../../../drizzle/schema';
import { type ItemRaw } from '../../../../../../../drizzle/types';
import { assertIsDefined } from '../../../../../../../utils/assertions';
import { GRAASPER_CREATOR_ID, ITEMS_ROUTE_PREFIX } from '../../../../../../../utils/config';
import { MeiliSearchWrapper } from './meilisearch';

jest.mock('./meilisearch');

const MOCK_INDEX = 'mock-index';

const moveDone = (id: string, dest: ItemRaw) => async () => {
  const result = await db.query.itemsRawTable.findFirst({ where: eq(itemsRawTable.id, id) });
  if (!result) {
    throw new Error('item does not exist!');
  }
  expect(result.path.startsWith(dest.path)).toBeTruthy();
};

describe('Collection Search endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  beforeEach(() => {
    jest.spyOn(MeiliSearchWrapper.prototype, 'getActiveIndexName').mockReturnValue(MOCK_INDEX);
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('Signed Out', () => {
    it('Returns search results', async () => {
      // Meilisearch is mocked so format of API doesn't matter, we just want it to proxy
      const fakeResponse = {
        results: [
          {
            hits: [],
            indexUid: MOCK_INDEX,
            estimatedTotalHits: 0,
            totalHits: 0,
            processingTimeMs: 10,
            query: '',
          },
        ],
      };
      const searchSpy = jest
        .spyOn(MeiliSearchWrapper.prototype, 'search')
        .mockResolvedValue(fakeResponse);

      const res = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
        payload: {},
      });

      // Check that the body is just proxied
      expect(searchSpy).toHaveBeenCalledWith({
        queries: [
          {
            attributesToHighlight: ['*'],
            filter: 'isPublishedRoot = true AND isHidden = false',
            indexUid: MOCK_INDEX,
            q: undefined,
          },
        ],
      });
      // Expect result from spied meilisearch
      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.json().hits).toEqual(fakeResponse.results[0].hits);
      expect(res.json().totalHits).toEqual(fakeResponse.results[0].totalHits);
    });
  });

  describe('Signed in', () => {
    it('Returns search results', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const fakeResponse = {
        results: [
          {
            hits: [],
            indexUid: MOCK_INDEX,
            estimatedTotalHits: 0,
            totalHits: 0,
            processingTimeMs: 10,
            query: '',
          },
        ],
      };
      jest.spyOn(MeiliSearchWrapper.prototype, 'search').mockResolvedValue(fakeResponse);

      const res = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
        payload: {},
      });

      // Expect result from spied meilisearch
      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.json().hits).toEqual(fakeResponse.results[0].hits);
      expect(res.json().totalHits).toEqual(fakeResponse.results[0].totalHits);
    });

    it('search with tags', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const searchSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'search');

      const expectedQuery: MultiSearchParams = {
        queries: [
          {
            attributesToHighlight: ['*'],
            q: 'random query',
            filter:
              "discipline IN ['random filter'] AND isPublishedRoot = true AND isHidden = false",
            indexUid: MOCK_INDEX,
          },
        ],
      };

      await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
        payload: {
          query: 'random query',
          tags: { [TagCategory.Discipline]: ['random filter'] },
        },
      });

      expect(searchSpy).toHaveBeenCalledWith(expectedQuery);
    });

    it('search with creator id', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const searchSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'search');
      const creatorId = v4();
      const expectedQuery: MultiSearchParams = {
        queries: [
          {
            attributesToHighlight: ['*'],
            q: 'random query',
            filter: `isPublishedRoot = true AND creator.id = '${creatorId}' AND isHidden = false`,
            indexUid: MOCK_INDEX,
          },
        ],
      };

      await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
        payload: {
          query: 'random query',
          creatorId,
        },
      });

      expect(searchSpy).toHaveBeenCalledWith(expectedQuery);
    });

    it('works with empty filters', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const searchSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'search');

      const expectedQuery: MultiSearchParams = {
        queries: [
          {
            attributesToHighlight: ['*'],
            q: 'random query',
            filter: 'isPublishedRoot = true AND isHidden = false',
            indexUid: MOCK_INDEX,
          },
        ],
      };

      await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
        payload: { query: 'random query' },
      });

      expect(searchSpy).toHaveBeenCalledWith(expectedQuery);
    });

    describe('triggers indexation on changes', () => {
      let indexSpy: jest.SpyInstance;
      let deleteSpy: jest.SpyInstance;

      beforeEach(async () => {
        indexSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'indexOne');
        deleteSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'deleteOne');
      });

      it('Patch item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              isPublished: true,
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              type: ItemType.DOCUMENT,
              extra: {
                [ItemType.DOCUMENT]: {
                  content: 'my text is here',
                },
              },
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
          extra: {
            [ItemType.DOCUMENT]: {
              content: 'updated text',
            },
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${item.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        expect(indexSpy).toHaveBeenCalledTimes(1);
        expect(indexSpy.mock.calls[0][1].item).toMatchObject(payload);
      });

      describe('Move', () => {
        it('Move published into unpublished should be indexed', async () => {
          const {
            actor,
            items: [item, unpublishedFolder],
          } = await seedFromJson({
            items: [
              {
                isPublic: true,
                isPublished: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const move1 = await app.inject({
            method: HttpMethod.Post,
            url: '/api/items/move',
            query: { id: item.id },
            payload: {
              parentId: unpublishedFolder.id,
            },
          });

          expect(move1.statusCode).toBe(StatusCodes.ACCEPTED);
          await waitForExpect(moveDone(item.id, unpublishedFolder), 300);
          await waitForExpect(async () => {
            expect(indexSpy).toHaveBeenCalledTimes(1);
            // Path update is sent to index
            expect(indexSpy.mock.calls[0][1].item.id).toEqual(item.id);
            expect(
              indexSpy.mock.calls[0][1].item.path.startsWith(unpublishedFolder.path),
            ).toBeTruthy();
          });
        });

        it('Move published into published folder should be indexed', async () => {
          const {
            actor,
            items: [item, publishedFolder],
          } = await seedFromJson({
            items: [
              {
                isPublic: true,
                isPublished: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                isPublic: true,
                isPublished: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const move2 = await app.inject({
            method: HttpMethod.Post,
            url: '/api/items/move',
            query: { id: item.id },
            payload: {
              parentId: publishedFolder.id,
            },
          });

          expect(move2.statusCode).toBe(StatusCodes.ACCEPTED);
          //wait for expect moved
          await waitForExpect(moveDone(item.id, publishedFolder), 300);
          expect(indexSpy).toHaveBeenCalledTimes(1);
          // Closest published at destination is reindexed
          expect(indexSpy.mock.calls[0][1].item.id).toEqual(item.id);
        });

        it('Move unpublished into published folder should be indexed', async () => {
          const {
            actor,
            items: [unpublishedItem, publishedFolder],
          } = await seedFromJson({
            items: [
              {
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
              {
                isPublic: true,
                isPublished: true,
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const move3 = await app.inject({
            method: HttpMethod.Post,
            url: '/api/items/move',
            query: { id: unpublishedItem.id },
            payload: {
              parentId: publishedFolder.id,
            },
          });

          expect(move3.statusCode).toBe(StatusCodes.ACCEPTED);
          await waitForExpect(moveDone(unpublishedItem.id, publishedFolder), 300);
          expect(indexSpy).toHaveBeenCalledTimes(1);
          // Topmost published at destination is reindexed
          expect(indexSpy.mock.calls[0][1].item.id).toEqual(publishedFolder.id);
        });

        it(' Move unpublished nested inside published into unpublished should be deleted from index', async () => {
          const {
            actor,
            items: [_parent, unpublishedItem, unpublishedFolder],
          } = await seedFromJson({
            items: [
              {
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
                isPublic: true,
                isPublished: true,
                children: [{}],
              },
              {
                memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const move4 = await app.inject({
            method: HttpMethod.Post,
            url: '/api/items/move',
            query: { id: unpublishedItem.id },
            payload: {
              parentId: unpublishedFolder.id,
            },
          });

          expect(move4.statusCode).toBe(StatusCodes.ACCEPTED);
          await waitForExpect(moveDone(unpublishedItem.id, unpublishedFolder), 300);
          expect(deleteSpy).toHaveBeenCalledTimes(1);
          // item is deleted from index
          expect(deleteSpy.mock.calls[0][1].id).toEqual(unpublishedItem.id);
        });
      });
    });
  });

  describe('GET /api/collections/facets', () => {
    it('throw if facet name is not provided', async () => {
      const res = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/facets`,
        body: {},
      });

      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('throw if facet name is not allowed', async () => {
      const res = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/facets`,
        query: { facetName: 'toto' },
        body: {},
      });

      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('get facets', async () => {
      // Meilisearch is mocked so format of API doesn't matter, we just want it to proxy MultiSearchParams;
      const fakeResponse = {
        results: [
          {
            indexUid: 'index',
            facetDistribution: {
              discipline: {
                fiction: 6,
              },
              level: {
                secondary: 3,
              },
            },
            hits: [{} as never],
            processingTimeMs: 123,
            query: '',
          },
        ],
      };
      jest.spyOn(MeiliSearchWrapper.prototype, 'search').mockResolvedValue(fakeResponse);
      const res = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/facets`,
        query: { facetName: 'discipline' },
        body: {},
      });
      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.json()).toEqual(fakeResponse.results[0].facetDistribution.discipline);
    });

    it('get facets with facet query', async () => {
      // Meilisearch is mocked so format of API doesn't matter, we just want it to proxy MultiSearchParams;
      const fakeResponse = {
        results: [
          {
            indexUid: 'index',
            facetDistribution: {
              discipline: {
                fiction: 6,
              },
              level: {
                secondary: 3,
              },
            },
            hits: [{} as never],
            processingTimeMs: 123,
            query: 'fiction',
          },
        ],
      };
      jest.spyOn(MeiliSearchWrapper.prototype, 'search').mockResolvedValue(fakeResponse);

      const res = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/facets`,
        query: { facetName: 'discipline' },
        body: { query: 'fiction' },
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.json()).toEqual(fakeResponse.results[0].facetDistribution.discipline);
    });
  });

  describe('GET /api/collections/featured', () => {
    it('get featured collections', async () => {
      // Meilisearch is mocked so format of API doesn't matter, we just want it to proxy MultiSearchParams;
      const fakeResponse = {
        results: [
          {
            indexUid: 'index',
            hits: [
              {
                name: 'Geogebra',
                description: 'Interactive tools from geogebra for mathematics.',
                content: '',
                creator: {
                  id: GRAASPER_CREATOR_ID,
                  name: 'Graasper',
                },
                level: [],
                discipline: [],
                'resource-type': [],
                id: v4(),
                type: 'folder',
                isPublishedRoot: true,
                isHidden: false,
                publicationUpdatedAt: '2021-10-20T13:03:42.712Z',
                createdAt: '2021-10-20T13:12:47.821Z',
                updatedAt: '2021-10-23T09:25:39.798Z',
                lang: 'en',
                likes: 9,
                _formatted: {
                  name: 'Geogebra',
                  description: 'Interactive tools from geogebra for mathematics.',
                  content: '',
                  creator: {
                    id: GRAASPER_CREATOR_ID,
                    name: 'Graasper',
                  },
                  level: [],
                  discipline: [],
                  'resource-type': [],
                  id: v4(),
                  type: 'folder',
                  isPublishedRoot: true,
                  isHidden: false,
                  publicationUpdatedAt: '2021-10-20T13:03:42.712Z',
                  createdAt: '2021-10-20T13:12:47.821Z',
                  updatedAt: '2021-10-23T09:25:39.798Z',
                  lang: 'en',
                  likes: 9,
                },
              },
              {
                name: 'PhET',
                content: '',
                description: '',
                creator: {
                  id: GRAASPER_CREATOR_ID,
                  name: 'Graasper',
                },
                level: [],
                discipline: [],
                'resource-type': [],
                id: v4(),
                type: 'folder',
                isPublishedRoot: true,
                isHidden: false,
                publicationUpdatedAt: '2021-10-20T13:03:42.712Z',
                createdAt: '2021-10-20T13:03:42.712Z',
                updatedAt: '2021-11-10T10:49:39.296Z',
                lang: 'en',
                likes: 7,
                _formatted: {
                  name: 'PhET',
                  description: '',
                  content: '',
                  creator: {
                    id: GRAASPER_CREATOR_ID,
                    name: 'Graasper',
                  },
                  level: [],
                  discipline: [],
                  'resource-type': [],
                  id: v4(),
                  type: 'folder',
                  isPublishedRoot: true,
                  isHidden: false,
                  publicationUpdatedAt: '2021-10-20T13:03:42.712Z',
                  createdAt: '2021-10-20T13:03:42.712Z',
                  updatedAt: '2021-11-10T10:49:39.296Z',
                  lang: 'en',
                  likes: 7,
                },
              },
            ] as never[],
            processingTimeMs: 123,
            query: '',
          },
        ],
      };
      jest.spyOn(MeiliSearchWrapper.prototype, 'search').mockResolvedValue(fakeResponse);
      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/collections/featured`,
      });
      expect(res.statusCode).toBe(StatusCodes.OK);
      // The creator should be Graasp (GRAASPER_CREATOR_ID)
      res.json().hits.forEach(({ creator }) => {
        expect(creator.id).toEqual(GRAASPER_CREATOR_ID);
      });
    });
  });

  describe('GET /api/collections/liked', () => {
    it('get most liked items', async () => {
      // Meilisearch is mocked so format of API doesn't matter, we just want it to proxy MultiSearchParams;
      const fakeResponse = {
        results: [
          {
            indexUid: 'index',
            hits: [
              {
                name: 'Geogebra',
                description: 'Interactive tools from geogebra for mathematics.',
                content: '',
                creator: {
                  id: v4(),
                  name: 'Graasper',
                },
                level: [],
                discipline: [],
                'resource-type': [],
                id: v4(),
                type: 'folder',
                isPublishedRoot: true,
                isHidden: false,
                publicationUpdatedAt: '2021-10-20T13:03:42.712Z',
                createdAt: '2021-10-20T13:12:47.821Z',
                updatedAt: '2021-10-23T09:25:39.798Z',
                lang: 'en',
                likes: 9,
                _formatted: {
                  name: 'Geogebra',
                  description: 'Interactive tools from geogebra for mathematics.',
                  content: '',
                  creator: {
                    id: v4(),
                    name: 'Graasper',
                  },
                  level: [],
                  discipline: [],
                  'resource-type': [],
                  id: v4(),
                  type: 'folder',
                  isPublishedRoot: true,
                  isHidden: false,
                  publicationUpdatedAt: '2021-10-20T13:03:42.712Z',
                  createdAt: '2021-10-20T13:12:47.821Z',
                  updatedAt: '2021-10-23T09:25:39.798Z',
                  lang: 'en',
                  likes: 9,
                },
              },
              {
                name: 'PhET',
                content: '',
                description: '',
                creator: {
                  id: v4(),
                  name: 'Graasper',
                },
                level: [],
                discipline: [],
                'resource-type': [],
                id: v4(),
                type: 'folder',
                isPublishedRoot: true,
                isHidden: false,
                publicationUpdatedAt: '2021-10-20T13:03:42.712Z',
                createdAt: '2021-10-20T13:03:42.712Z',
                updatedAt: '2021-11-10T10:49:39.296Z',
                lang: 'en',
                likes: 7,
                _formatted: {
                  name: 'PhET',
                  description: '',
                  content: '',
                  creator: {
                    id: v4(),
                    name: 'Graasper',
                  },
                  level: [],
                  discipline: [],
                  'resource-type': [],
                  id: v4(),
                  type: 'folder',
                  isPublishedRoot: true,
                  isHidden: false,
                  publicationUpdatedAt: '2021-10-20T13:03:42.712Z',
                  createdAt: '2021-10-20T13:03:42.712Z',
                  updatedAt: '2021-11-10T10:49:39.296Z',
                  lang: 'en',
                  likes: 7,
                },
              },
            ] as never[],
            processingTimeMs: 123,
            query: '',
          },
        ],
      };
      jest.spyOn(MeiliSearchWrapper.prototype, 'search').mockResolvedValue(fakeResponse);
      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/collections/liked`,
      });
      expect(res.statusCode).toBe(StatusCodes.OK);
      // should return the likes property
      res.json().hits.forEach(({ likes }) => {
        expect(likes).toBeGreaterThanOrEqual(0);
      });
    });
  });
  describe('GET /api/collections/recent', () => {
    describe('Signed Out', () => {
      it('Get 2 most recent collections', async () => {
        // Meilisearch is mocked so format of API doesn't matter, we just want it to proxy MultiSearchParams;
        const fakeResponse = {
          results: [
            {
              indexUid: 'index',
              hits: [
                {
                  name: 'Geogebra',
                  description: 'Interactive tools from geogebra for mathematics.',
                  content: '',
                  creator: {
                    id: v4(),
                    name: 'Graasper',
                  },
                  level: [],
                  discipline: [],
                  'resource-type': [],
                  id: v4(),
                  type: 'folder',
                  isPublishedRoot: true,
                  isHidden: false,
                  publicationUpdatedAt: '2021-10-20T13:03:42.712Z',
                  createdAt: '2021-10-20T13:12:47.821Z',
                  updatedAt: '2021-10-23T09:25:39.798Z',
                  lang: 'en',
                  likes: 9,
                  _formatted: {
                    name: 'Geogebra',
                    description: 'Interactive tools from geogebra for mathematics.',
                    content: '',
                    creator: {
                      id: v4(),
                      name: 'Graasper',
                    },
                    level: [],
                    discipline: [],
                    'resource-type': [],
                    id: v4(),
                    type: 'folder',
                    isPublishedRoot: true,
                    isHidden: false,
                    publicationUpdatedAt: '2021-10-20T13:03:42.712Z',
                    createdAt: '2021-10-20T13:12:47.821Z',
                    updatedAt: '2021-10-23T09:25:39.798Z',
                    lang: 'en',
                    likes: 9,
                  },
                },
                {
                  name: 'PhET',
                  content: '',
                  description: '',
                  creator: {
                    id: v4(),
                    name: 'Graasper',
                  },
                  level: [],
                  discipline: [],
                  'resource-type': [],
                  id: v4(),
                  type: 'folder',
                  isPublishedRoot: true,
                  isHidden: false,
                  publicationUpdatedAt: '2021-10-20T13:03:42.712Z',
                  createdAt: '2021-10-20T13:03:42.712Z',
                  updatedAt: '2021-11-10T10:49:39.296Z',
                  lang: 'en',
                  likes: 7,
                  _formatted: {
                    name: 'PhET',
                    description: '',
                    content: '',
                    creator: {
                      id: v4(),
                      name: 'Graasper',
                    },
                    level: [],
                    discipline: [],
                    'resource-type': [],
                    id: v4(),
                    type: 'folder',
                    isPublishedRoot: true,
                    publicationUpdatedAt: '2021-10-20T13:03:42.712Z',
                    isHidden: false,
                    createdAt: '2021-10-20T13:03:42.712Z',
                    updatedAt: '2021-11-10T10:49:39.296Z',
                    lang: 'en',
                    likes: 7,
                  },
                },
              ] as never[],
              processingTimeMs: 123,
              query: '',
            },
          ],
        };
        jest.spyOn(MeiliSearchWrapper.prototype, 'search').mockResolvedValue(fakeResponse);
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/recent?limit=2`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json().hits).toHaveLength(2);
      });
    });
  });
});
