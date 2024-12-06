import { StatusCodes } from 'http-status-codes';
import { MultiSearchParams } from 'meilisearch';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, ItemVisibilityType, PermissionLevel } from '@graasp/sdk';

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

describe('Collection Search endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
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
      const fakePayload = { queries: [] } as MultiSearchParams;
      const fakeResponse = { results: [] };
      const searchSpy = jest
        .spyOn(MeiliSearchWrapper.prototype, 'search')
        .mockResolvedValue(fakeResponse);

      const res = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
        payload: fakePayload,
      });

      // Check that the body is just proxied
      expect(searchSpy).toHaveBeenCalledWith(fakePayload);
      // Expect result from spied meilisearch
      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.json()).toEqual(fakeResponse);
    });
  });

  describe('Signed in', () => {
    let actor;

    it('Returns search results', async () => {
      actor = await saveMember();
      mockAuthenticate(actor);

      // Meilisearch is mocked so format of API doesn't matter, we just want it to proxy
      const fakePayload = { queries: [] } as MultiSearchParams;
      const fakeResponse = { results: [] };
      const searchSpy = jest
        .spyOn(MeiliSearchWrapper.prototype, 'search')
        .mockResolvedValue(fakeResponse);

      const res = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
        payload: fakePayload,
      });

      // Check that the body is just proxied
      expect(searchSpy).toHaveBeenCalledWith(fakePayload);
      // Expect result from spied meilisearch
      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.json()).toEqual(fakeResponse);
    });

    it('search is delegated to meilisearch SDK with a forced filter', async () => {
      actor = await saveMember();
      mockAuthenticate(actor);

      const searchSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'search');

      const userQuery: MultiSearchParams = {
        queries: [{ q: 'random query', filter: 'random filter', indexUid: 'index' }],
      };
      const expectedQuery: MultiSearchParams = {
        queries: [
          {
            attributesToHighlight: ['*'],
            q: 'random query',
            filter: '(random filter) AND isHidden = false',
            indexUid: 'index',
          },
        ],
      };

      await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
        payload: userQuery,
      });

      expect(searchSpy).toHaveBeenCalledWith(expectedQuery);
    });

    it('works with empty filters', async () => {
      actor = await saveMember();
      mockAuthenticate(actor);

      const searchSpy = jest.spyOn(MeiliSearchWrapper.prototype, 'search');

      const userQuery: MultiSearchParams = {
        queries: [{ q: 'random query', indexUid: 'index' }],
      };
      const expectedQuery: MultiSearchParams = {
        queries: [
          {
            attributesToHighlight: ['*'],
            q: 'random query',
            filter: 'isHidden = false',
            indexUid: 'index',
          },
        ],
      };

      await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/collections/search`,
        payload: userQuery,
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
        expect(indexSpy.mock.calls[0][0]).toMatchObject(payload);
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
          expect(indexSpy.mock.calls[0][0].id).toEqual(item.id);
          expect(indexSpy.mock.calls[0][0].path.startsWith(unpublishedFolder.path)).toBeTruthy();
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
          expect(indexSpy.mock.calls[0][0].id).toEqual(item.id);
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
          expect(indexSpy.mock.calls[0][0].id).toEqual(publishedFolder.id);
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
          expect(deleteSpy.mock.calls[0][0].id).toEqual(unpublishedItem.id);
        });
      });

      it('Copy', async () => {
        const { item: unpublishedItem } = await testUtils.saveItemAndMembership({
          member: actor,
          item: { name: 'unpublishedItem' },
        });

        const initialCount = await testUtils.rawItemRepository.count();
        const copy = await app.inject({
          method: HttpMethod.Post,
          url: '/items/copy',
          query: { id: unpublishedItem.id },
          payload: {
            parentId: publishedFolder.id,
          },
        });

        expect(copy.statusCode).toBe(StatusCodes.ACCEPTED);

        await waitForExpect(async () => {
          const newCount = await testUtils.rawItemRepository.count();
          expect(newCount).toEqual(initialCount + 1);
        }, 1000);

        expect(indexSpy).toHaveBeenCalledTimes(1);
        // Topmost published at destination is reindexed
        expect(indexSpy.mock.calls[0][0].id).not.toEqual(unpublishedItem.id);
        expect(indexSpy.mock.calls[0][0].name).toEqual('unpublishedItem');
      });
    });
  });

  describe('GET /collections/facets', () => {
    it('throw if facet name is not provided', async () => {
      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/collections/facets`,
        query: {},
      });

      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('get facets', async () => {
      // Meilisearch is mocked so format of API doesn't matter, we just want it to proxy MultiSearchParams;
      const fakeResponse = {
        facetHits: [
          {
            value: 'fiction',
            count: 7,
          },
        ],
        facetQuery: 'fiction',
        processingTimeMs: 0,
      };
      jest.spyOn(MeiliSearchWrapper.prototype, 'getFacets').mockResolvedValue(fakeResponse);

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/collections/facets`,
        query: { facetName: 'discipline' },
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.json()).toEqual(fakeResponse);
    });

    it('get facets with facet query', async () => {
      // Meilisearch is mocked so format of API doesn't matter, we just want it to proxy MultiSearchParams;
      const fakeResponse = {
        facetHits: [
          {
            value: 'fiction',
            count: 7,
          },
        ],
        facetQuery: 'fiction',
        processingTimeMs: 0,
      };
      jest.spyOn(MeiliSearchWrapper.prototype, 'getFacets').mockResolvedValue(fakeResponse);

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/collections/facets`,
        query: { facetName: 'discipline', facetQuery: 'fiction' },
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.json()).toEqual(fakeResponse);
    });
  });
});
