import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemVisibilityType } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { ItemVisibilityRaw } from '../../../../../drizzle/types';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { saveMember } from '../../../../member/test/fixtures/members';
import { ItemTestUtils } from '../../../test/fixtures/items';
import {
  CannotModifyParentVisibility,
  ConflictingVisibilitiesInTheHierarchy,
  ItemVisibilityNotFound,
} from '../errors';

const testUtils = new ItemTestUtils();
const rawItemTagRepository = AppDataSource.getRepository(ItemVisibility);

export const saveTagsForItem = async ({ item, creator }) => {
  const itemVisibilities: ItemVisibilityRaw[] = [];
  itemVisibilities.push(
    await rawItemTagRepository.save({ item, creator, type: ItemVisibilityType.Hidden }),
  );

  return itemVisibilities;
};

describe('Item Visibility', () => {
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

  describe('POST /:itemId/visibilities', () => {
    let item;
    const type = ItemVisibilityType.Hidden;

    describe('Signed Out', () => {
      it('Throws if item is private', async () => {
        const member = await saveMember();
        ({ item } = await testUtils.saveItemAndMembership({ member }));

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${type}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Create a visibility for an item', async () => {
        ({ item } = await testUtils.saveItemAndMembership({ member: actor }));

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${type}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json().type).toEqual(type);
        expect(res.json().item.path).toEqual(item.path);
      });

      it('Cannot create visibility if exists for item', async () => {
        ({ item } = await testUtils.saveItemAndMembership({ member: actor }));
        await rawItemTagRepository.save({ item, type, creator: actor });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${type}`,
        });
        expect(res.json()).toMatchObject(
          new ConflictingVisibilitiesInTheHierarchy(expect.anything()),
        );
      });

      it('Cannot create visibility if exists on parent', async () => {
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        ({ item } = await testUtils.saveItemAndMembership({ member: actor, parentItem: parent }));
        await rawItemTagRepository.save({ item: parent, type, creator: actor });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${type}`,
        });
        expect(res.json()).toMatchObject(
          new ConflictingVisibilitiesInTheHierarchy(expect.anything()),
        );
      });

      it('Bad request if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/visibilities/${type}`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if type is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/visibilities/invalid-type`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if type is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/visibilities/invalid-type`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('DELETE /:itemId/visibilities/:id', () => {
    let item, itemVisibilities;
    const type = ItemVisibilityType.Public;

    describe('Signed Out', () => {
      it('Throws if item is private', async () => {
        const member = await saveMember();
        ({ item } = await testUtils.saveItemAndMembership({ member }));

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/visibilities/${type}`,
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
        itemVisibilities = await saveTagsForItem({ item, creator: actor });
        toDelete = itemVisibilities[0];
      });

      it('Delete a visibility of an item (and descendants)', async () => {
        const { item: child } = await testUtils.saveItemAndMembership({
          member: actor,
          parentItem: item,
        });
        const childTags = await saveTagsForItem({ item: child, creator: actor });
        const descendantToDelete = childTags.find(({ type }) => type === toDelete.type);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${toDelete.type}`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json().item.path).toEqual(item.path);
        const itemVisibility = await rawItemTagRepository.findOneBy({ id: toDelete.id });
        expect(itemVisibility).toBeNull();
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const childItemTag = await rawItemTagRepository.findOneBy({ id: descendantToDelete!.id });
        expect(childItemTag).toBeNull();
      });
      it('Cannot delete inherited visibility', async () => {
        const { item: parent } = await testUtils.saveItemAndMembership({ member: actor });
        ({ item } = await testUtils.saveItemAndMembership({ member: actor, parentItem: parent }));
        const visibility = await rawItemTagRepository.save({ item: parent, type, creator: actor });

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${visibility.type}`,
        });
        expect(res.json()).toMatchObject(new CannotModifyParentVisibility(expect.anything()));
      });
      it('Throws if visibility does not exist', async () => {
        const { item: itemWithoutTag } = await testUtils.saveItemAndMembership({ member: actor });

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${itemWithoutTag.id}/visibilities/${ItemVisibilityType.Hidden}`,
        });
        expect(res.json()).toMatchObject(new ItemVisibilityNotFound(expect.anything()));
      });
      it('Bad request if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/visibilities/${ItemVisibilityType.Hidden}`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Bad request if item visibility id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/visibilities/invalid-id`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
