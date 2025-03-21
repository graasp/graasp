import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemVisibilityType } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { AppDataSource } from '../../../../../plugins/datasource';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { ItemVisibility } from '../ItemVisibility';
import {
  CannotModifyParentVisibility,
  ConflictingVisibilitiesInTheHierarchy,
  ItemVisibilityNotFound,
} from '../errors';

const rawItemTagRepository = AppDataSource.getRepository(ItemVisibility);

export const saveTagsForItem = async ({ item, creator }) => {
  const itemVisibilities: ItemVisibility[] = [];
  itemVisibilities.push(
    await rawItemTagRepository.save({ item, creator, type: ItemVisibilityType.Hidden }),
  );

  return itemVisibilities;
};

describe('Item Visibility', () => {
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

  describe('POST /:itemId/visibilities', () => {
    describe('Signed Out', () => {
      it('Throws if item is private', async () => {
        const {
          items: [item],
        } = await seedFromJson({ actor: null, items: [{}] });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${ItemVisibilityType.Hidden}`,
        });

        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      it('Create a visibility for an item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${ItemVisibilityType.Hidden}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json().type).toEqual(ItemVisibilityType.Hidden);
        expect(res.json().item.path).toEqual(item.path);
      });

      it('Cannot create visibility if exists for item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ isHidden: true, memberships: [{ account: 'actor' }] }],
        });
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${ItemVisibilityType.Hidden}`,
        });
        expect(res.json()).toMatchObject(
          new ConflictingVisibilitiesInTheHierarchy(expect.anything()),
        );
      });

      it('Cannot create visibility if exists on parent', async () => {
        const {
          actor,
          items: [_parentItem, child],
        } = await seedFromJson({
          items: [{ isHidden: true, memberships: [{ account: 'actor' }], children: [{}] }],
        });
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${child.id}/visibilities/${ItemVisibilityType.Hidden}`,
        });
        expect(res.json()).toMatchObject(
          new ConflictingVisibilitiesInTheHierarchy(expect.anything()),
        );
      });

      it('Bad request if item id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/visibilities/${ItemVisibilityType.Hidden}`,
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

    describe('DELETE /:itemId/visibilities/:id', () => {
      describe('Signed Out', () => {
        it('Throws if item is private', async () => {
          const {
            items: [item],
          } = await seedFromJson({ actor: null, items: [{}] });

          const response = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${ItemVisibilityType.Public}`,
          });

          expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
        });
      });

      describe('Signed In', () => {
        it('Delete a visibility of an item (and descendants)', async () => {
          const {
            actor,
            items: [parentItem],
            itemVisibilities: [parentPublicVisibility, childPublicVisibility],
          } = await seedFromJson({
            items: [
              {
                isPublic: true,
                memberships: [{ account: 'actor' }],
                children: [{ isPublic: true }],
              },
            ],
          });
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/${parentItem.id}/visibilities/${ItemVisibilityType.Public}`,
          });

          expect(res.statusCode).toBe(StatusCodes.OK);
          expect(res.json().item.path).toEqual(parentItem.path);
          const itemVisibility = await rawItemTagRepository.findOneBy({
            id: parentPublicVisibility.id,
          });
          expect(itemVisibility).toBeNull();
          const childItemTag = await rawItemTagRepository.findOneBy({
            id: childPublicVisibility.id,
          });
          expect(childItemTag).toBeNull();
        });
        it('Cannot delete inherited visibility', async () => {
          const {
            actor,
            items: [_parentItem, child],
          } = await seedFromJson({
            items: [
              {
                isPublic: true,
                memberships: [{ account: 'actor' }],
                children: [{}],
              },
            ],
          });
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/${child.id}/visibilities/${ItemVisibilityType.Public}`,
          });
          expect(res.json()).toMatchObject(new CannotModifyParentVisibility(expect.anything()));
        });
        it('Throws if visibility does not exist', async () => {
          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [
              {
                memberships: [{ account: 'actor' }],
              },
            ],
          });
          mockAuthenticate(actor);

          const res = await app.inject({
            method: HttpMethod.Delete,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/visibilities/${ItemVisibilityType.Hidden}`,
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
});
