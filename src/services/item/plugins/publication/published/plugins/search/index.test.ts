import { StatusCodes } from 'http-status-codes';
import { MultiSearchParams } from 'meilisearch';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import {
  HttpMethod,
  ItemType,
  ItemVisibilityType,
  PermissionLevel,
  TagCategory,
} from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../../../test/app';
import { AppDataSource } from '../../../../../../../plugins/datasource';
import { ITEMS_ROUTE_PREFIX } from '../../../../../../../utils/config';
import { saveMember } from '../../../../../../member/test/fixtures/members';
import { Item } from '../../../../../entities/Item';
import { ItemTestUtils } from '../../../../../test/fixtures/items';
import { ItemVisibility } from '../../../../itemVisibility/ItemVisibility';
import { ItemPublished } from '../../entities/itemPublished';
import { ItemPublishedRepository } from '../../repositories/itemPublished';
import { MeiliSearchWrapper } from './meilisearch';

const testUtils = new ItemTestUtils();

jest.mock('./meilisearch');

const rawRepository = AppDataSource.getRepository(ItemVisibility);
const itemPublishedRawRepository = AppDataSource.getRepository(ItemPublished);

const MOCK_INDEX = 'mock-index';

describe('Collection Search endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  beforeEach(() => {
    jest.spyOn(MeiliSearchWrapper.prototype, 'getActiveIndexName').mockReturnValue(MOCK_INDEX);
  });

  afterAll(async () => {
    await clearDatabase(app.db);
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
            sort: ['publishedUpdatedAt:desc'],
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
    let actor;

    it('Returns search results', async () => {
      actor = await saveMember();
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
      actor = await saveMember();
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
            sort: ['publishedUpdatedAt:desc'],
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
      actor = await saveMember();
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
      actor = await saveMember();
      mockAuthenticate(actor);

      const searchSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'search');

      const expectedQuery: MultiSearchParams = {
        queries: [
          {
            attributesToHighlight: ['*'],
            q: 'random query',
            filter: 'isPublishedRoot = true AND isHidden = false',
            indexUid: MOCK_INDEX,
            sort: ['publishedUpdatedAt:desc'],
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
      let item: Item;
      let publishedFolder: Item;
      let indexSpy;
      let deleteSpy;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);

        // Start with a published item
        const extra = {
          [ItemType.DOCUMENT]: {
            content: 'my text is here',
          },
        };
        ({ item } = await testUtils.saveItemAndMembership({
          item: { type: ItemType.DOCUMENT, extra },
          creator: actor,
          member: actor,
          permission: PermissionLevel.Admin,
        }));
        await rawRepository.save({ item, type: ItemVisibilityType.Public, creator: actor });
        await new ItemPublishedRepository().post(actor, item);

        ({ item: publishedFolder } = await testUtils.saveItemAndMembership({ member: actor }));
        await rawRepository.save({
          item: publishedFolder,
          type: ItemVisibilityType.Public,
          creator: actor,
        });
        await itemPublishedRawRepository.save({ item: publishedFolder, creator: actor });

        indexSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'indexOne');
        deleteSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'deleteOne');
      });

      it('Patch item', async () => {
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
          url: `/items/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(indexSpy).toHaveBeenCalledTimes(1);
        expect(indexSpy.mock.calls[0][0].item).toMatchObject(payload);
      });

      describe('Move', () => {
        let moveDone;
        let unpublishedFolder: Item;

        beforeEach(async () => {
          moveDone = (id: string, dest: Item) => async () => {
            const result = await testUtils.rawItemRepository.findOneBy({ id: id });
            if (!result) {
              throw new Error('item does not exist!');
            }
            expect(result.path.startsWith(dest.path)).toBeTruthy();
          };
          ({ item: unpublishedFolder } = await testUtils.saveItemAndMembership({
            member: actor,
          }));
        });

        it('Move published into unpublished should be indexed', async () => {
          const move1 = await app.inject({
            method: HttpMethod.Post,
            url: '/items/move',
            query: { id: item.id },
            payload: {
              parentId: unpublishedFolder.id,
            },
          });

          expect(move1.statusCode).toBe(StatusCodes.ACCEPTED);
          await waitForExpect(moveDone(item.id, unpublishedFolder), 300);
          expect(indexSpy).toHaveBeenCalledTimes(1);
          // Path update is sent to index
          expect(indexSpy.mock.calls[0][0].item.id).toEqual(item.id);
          expect(
            indexSpy.mock.calls[0][0].item.path.startsWith(unpublishedFolder.path),
          ).toBeTruthy();
        });

        it('Move published into published folder should be indexed', async () => {
          const move2 = await app.inject({
            method: HttpMethod.Post,
            url: '/items/move',
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
          expect(indexSpy.mock.calls[0][0].item.id).toEqual(item.id);
        });

        it('Move unpublished into published folder should be indexed', async () => {
          const { item: unpublishedItem } = await testUtils.saveItemAndMembership({
            member: actor,
            item: { name: 'unpublishedItem' },
          });
          const move3 = await app.inject({
            method: HttpMethod.Post,
            url: '/items/move',
            query: { id: unpublishedItem.id },
            payload: {
              parentId: publishedFolder.id,
            },
          });

          expect(move3.statusCode).toBe(StatusCodes.ACCEPTED);
          await waitForExpect(moveDone(unpublishedItem.id, publishedFolder), 300);
          expect(indexSpy).toHaveBeenCalledTimes(1);
          // Topmost published at destination is reindexed
          expect(indexSpy.mock.calls[0][0].item.id).toEqual(publishedFolder.id);
        });

        it(' Move unpublished nested inside published into unpublished should be deleted from index', async () => {
          const { item: unpublishedItem } = await testUtils.saveItemAndMembership({
            member: actor,
            item: { name: 'unpublishedItem' },
          });

          const move4 = await app.inject({
            method: HttpMethod.Post,
            url: '/items/move',
            query: { id: unpublishedItem.id },
            payload: {
              parentId: unpublishedFolder.id,
            },
          });

          expect(move4.statusCode).toBe(StatusCodes.ACCEPTED);
          await waitForExpect(moveDone(unpublishedItem.id, unpublishedFolder), 300);
          expect(deleteSpy).toHaveBeenCalledTimes(1);
          // item is deleted from index
          expect(deleteSpy.mock.calls[0][0].item.id).toEqual(unpublishedItem.id);
        });
      });
    });
  });

  describe('GET /collections/facets', () => {
    it('throw if facet name is not provided', async () => {
      const res = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/facets`,
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

  describe('GET /collections/liked', () => {
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
  describe('GET /collections/recent', () => {
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
