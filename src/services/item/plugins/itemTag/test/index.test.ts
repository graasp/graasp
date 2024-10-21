import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemTagType } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { AppDataSource } from '../../../../../plugins/datasource';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { saveMember } from '../../../../member/test/fixtures/members';
import { ItemTestUtils } from '../../../test/fixtures/items';
import { ItemTag } from '../ItemTag';
import { CannotModifyParentTag, ConflictingTagsInTheHierarchy, ItemTagNotFound } from '../errors';

const testUtils = new ItemTestUtils();
const rawItemTagRepository = AppDataSource.getRepository(ItemTag);

export const saveTagsForItem = async ({ item, creator }) => {
  const itemTags: ItemTag[] = [];
  itemTags.push(await rawItemTagRepository.save({ item, creator, type: ItemTagType.Hidden }));

  return itemTags;
};

describe('Tags', () => {
  let app: FastifyInstance;
  let actor;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    actor = null;
    unmockAuthenticate();
  });

  describe('POST /:itemId/tags', () => {
    let item;
    const type = ItemTagType.Hidden;

    describe('Signed Out', () => {
      it('Throws if item is private', async () => {
        const member = await saveMember();
        ({ item } = await testUtils.saveItemAndMembership({ member }));

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/tags/${type}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Create a tag for an item', async () => {
        ({ item } = await testUtils.saveItemAndMembership({ member: actor }));

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/tags/${type}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json().type).toEqual(type);
        expect(res.json().item.path).toEqual(item.path);
      });

      it('Cannot create tag if exists for item', async () => {
        ({ item } = await testUtils.saveItemAndMembership({ member: actor }));
        await rawItemTagRepository.save({ item, type, creator: actor });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/tags/${type}`,
        });
        expect(res.json()).toMatchObject(new ConflictingTagsInTheHierarchy(expect.anything()));
      });

      it('Cannot create tag if exists on parent', async () => {
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        ({ item } = await testUtils.saveItemAndMembership({ member: actor, parentItem: parent }));
        await rawItemTagRepository.save({ item: parent, type, creator: actor });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/tags/${type}`,
        });
        expect(res.json()).toMatchObject(new ConflictingTagsInTheHierarchy(expect.anything()));
      });

      it('Bad request if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/tags/${type}`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if type is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/tags/invalid-type`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if type is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/tags/invalid-type`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('DELETE /:itemId/tags/:id', () => {
    let item, itemTags;
    const type = ItemTagType.Public;

    describe('Signed Out', () => {
      it('Throws if item is private', async () => {
        const member = await saveMember();
        ({ item } = await testUtils.saveItemAndMembership({ member }));

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/tags/${type}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      let toDelete;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);

        ({ item } = await testUtils.saveItemAndMembership({ member: actor }));
        itemTags = await saveTagsForItem({ item, creator: actor });
        toDelete = itemTags[0];
      });

      it('Delete a tag of an item (and descendants)', async () => {
        const { item: child } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: item,
        });
        const childTags = await saveTagsForItem({ item: child, creator: actor });
        const descendantToDelete = childTags.find(({ type }) => type === toDelete.type);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/tags/${toDelete.type}`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json().item.path).toEqual(item.path);
        const itemTag = await rawItemTagRepository.findOneBy({ id: toDelete.id });
        expect(itemTag).toBeNull();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const childItemTag = await rawItemTagRepository.findOneBy({ id: descendantToDelete!.id });
        expect(childItemTag).toBeNull();
      });
      it('Cannot delete inherited tag', async () => {
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        ({ item } = await testUtils.saveItemAndMembership({ member: actor, parentItem: parent }));
        const tag = await rawItemTagRepository.save({ item: parent, type, creator: actor });

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/tags/${tag.type}`,
        });
        expect(res.json()).toMatchObject(new CannotModifyParentTag(expect.anything()));
      });
      it('Throws if tag does not exist', async () => {
        const { item: itemWithoutTag } = await testUtils.saveItemAndMembership({ member: actor });

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${itemWithoutTag.id}/tags/${ItemTagType.Hidden}`,
        });
        expect(res.json()).toMatchObject(new ItemTagNotFound(expect.anything()));
      });
      it('Bad request if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/tags/${ItemTagType.Hidden}`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Bad request if item tag id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/tags/invalid-id`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
