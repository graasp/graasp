import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, ItemValidationStatus, PublicationStatus } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { db } from '../../../../../drizzle/db';
import { itemValidationsTable } from '../../../../../drizzle/schema';
import type {
  ItemValidationGroupRaw,
  ItemValidationGroupWithItemAndValidations,
  ItemValidationRaw,
} from '../../../../../drizzle/types';
import { assertIsDefined } from '../../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { MemberCannotAdminItem } from '../../../../../utils/errors';
import type { ItemRaw } from '../../../item';
import { ItemValidationService } from './itemValidation.service';
import { type ItemModeratorValidate, stubItemModerator } from './test/utils';

const VALIDATION_LOADING_TIME = 2000;

const fetchStatus = async (app: FastifyInstance, itemId: string) =>
  await app.inject({
    method: HttpMethod.Get,
    url: `${ITEMS_ROUTE_PREFIX}/publication/${itemId}/status`,
  });

const expectItemValidation = (
  iv: ItemValidationGroupWithItemAndValidations,
  correctIV: ItemValidationGroupRaw & { itemValidations: ItemValidationRaw[] },
) => {
  expect(iv.id).toEqual(correctIV.id);
  expect(iv.item.id).toEqual(correctIV.itemId);
  expect(iv.itemValidations).toHaveLength(correctIV.itemValidations.length);
};

describe('Item Validation Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('GET /:itemId/validations/latest', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/latest`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Get latest item validation', async () => {
        const {
          items: [item],
          actor,
          itemValidationGroups: [itemValidationGroup],
          itemValidations,
        } = await seedFromJson({
          items: [
            {
              itemValidations: [{ groupName: 'group', status: ItemValidationStatus.Pending }],
              memberships: [{ account: 'actor', permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/latest`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expectItemValidation(res.json(), { ...itemValidationGroup, itemValidations });
      });

      it('Throws if has read permission', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: 'read' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/latest`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Throws if has write permission', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: 'write' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/latest`,
        });
        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));

        // check no created entries
      });

      it('Bad request if id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/validations/latest`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/latest`,
        });
        expect(res.json().statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
    });
  });

  // REMOVE? not used anymore
  // describe('GET /:itemId/validations/:itemValidationGroupId', () => {
  //   it('Throws if signed out', async () => {
  //     const response = await app.inject({
  //       method: HttpMethod.Get,
  //       url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/${v4()}`,
  //     });

  //     expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  //   });

  //   describe('Signed In', () => {
  //     it('Get item validation groups', async () => {
  //       const {
  //         items: [item],
  //         actor,
  //         itemValidationGroups: [itemValidationGroup],
  //       } = await seedFromJson({
  //         items: [
  //           {
  //             itemValidations: [{ groupName: 'name', status: ItemValidationStatus.Failure }],
  //             memberships: [{ account: 'actor', permission: "admin" }],
  //           },
  //         ],
  //       });
  //       assertIsDefined(actor);
  //       mockAuthenticate(actor);

  //       const res = await app.inject({
  //         method: HttpMethod.Get,
  //         url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/${itemValidationGroup.id}`,
  //       });
  //       expect(res.statusCode).toBe(StatusCodes.OK);
  //       expectItemValidation(res.json(), itemValidationGroup);
  //     });

  //     it('Throws if has read permission', async () => {
  //       const {
  //         items: [item],
  //         actor,
  //         itemValidationGroups: [itemValidationGroup],
  //       } = await seedFromJson({
  //         items: [{ memberships: [{ account: 'actor', permission: "read" }] }],
  //       });
  //       assertIsDefined(actor);
  //       mockAuthenticate(actor);

  //       const res = await app.inject({
  //         method: HttpMethod.Get,
  //         // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  //         url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/${itemValidationGroup!.id}`,
  //       });
  //       expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
  //     });

  //     it('Throws if has write permission', async () => {
  //       const {
  //         items: [item],
  //         actor,
  //         itemValidationGroups: [itemValidationGroup],
  //       } = await seedFromJson({
  //         items: [{ memberships: [{ account: 'actor', permission: "write" }] }],
  //       });
  //       assertIsDefined(actor);
  //       mockAuthenticate(actor);

  //       const res = await app.inject({
  //         method: HttpMethod.Get,
  //         // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  //         url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/${itemValidationGroup!.id}`,
  //       });
  //       expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
  //     });

  //     it('Bad request if id is invalid', async () => {
  //       const { actor } = await seedFromJson();
  //       assertIsDefined(actor);
  //       mockAuthenticate(actor);

  //       const res = await app.inject({
  //         method: HttpMethod.Get,
  //         url: `${ITEMS_ROUTE_PREFIX}/invalid-id/validations/${v4()}`,
  //       });
  //       expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
  //     });

  //     it('Throws if item does not exist', async () => {
  //       const { actor } = await seedFromJson();
  //       assertIsDefined(actor);
  //       mockAuthenticate(actor);

  //       const res = await app.inject({
  //         method: HttpMethod.Get,
  //         url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/${v4()}`,
  //       });
  //       expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
  //     });

  //     it('Bad request if group id is invalid', async () => {
  //       const { actor } = await seedFromJson();
  //       assertIsDefined(actor);
  //       mockAuthenticate(actor);

  //       const res = await app.inject({
  //         method: HttpMethod.Get,
  //         url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validations/invalid-id`,
  //       });
  //       expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
  //     });

  //     it('Throws if validation group does not exist', async () => {
  //       const {
  //         actor,
  //         items: [item],
  //       } = await seedFromJson({ items: [{}] });
  //       assertIsDefined(actor);
  //       mockAuthenticate(actor);

  //       const res = await app.inject({
  //         method: HttpMethod.Get,
  //         url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validations/${v4()}`,
  //       });
  //       expect(res.json()).toMatchObject(new ItemValidationGroupNotFound(expect.anything()));
  //     });
  //   });
  // });

  describe('POST /:itemId/validate', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validate`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('create validation', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              itemValidations: [{ groupName: 'name', status: ItemValidationStatus.Success }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);
        expect(res.body).toEqual(item.id);

        await waitForExpect(async () => {
          // previous and newly created validation group
          expect(
            await db.query.itemValidationsTable.findMany({
              where: eq(itemValidationsTable.itemId, item.id),
            }),
          ).toHaveLength(2);
        });

        // valid item should be published automatically
        const publishedRes = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/collections/${item.id}/informations`,
        });
        expect(publishedRes.statusCode).toBe(StatusCodes.OK);
        expect(publishedRes.json()?.item.id).toBe(item.id);
      });

      it('Status is pending for item and children when validation is not done', async () => {
        const {
          actor,
          items: [item, child],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              children: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        // stub the item moderator
        const stubValidate: ItemModeratorValidate = async (
          _db,
          itemToValidate: ItemRaw,
          _itemValidationGroupId,
        ) => {
          const isChildItem = itemToValidate.id === child.id;
          const timeout = isChildItem ? 500 : 0;
          // sleep to let the time to check pending status in the test
          await new Promise((resolve) => setTimeout(resolve, timeout));
          return [ItemValidationStatus.Success];
        };
        stubItemModerator(stubValidate);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

        // return valid status for validation
        await waitForExpect(async () => {
          const resStatus = [await fetchStatus(app, item.id), await fetchStatus(app, child.id)];
          expect([ItemValidationStatus.Pending, PublicationStatus.Published]).toContain(
            resStatus[0].body,
          );
          expect([ItemValidationStatus.Pending, PublicationStatus.PublishedChildren]).toContain(
            resStatus[1].body,
          );
        });
      });

      it('Throws if has read permission', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ memberships: [{ permission: 'read', account: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait for validation to happen before checking nothing was created
        await new Promise((res) => {
          setTimeout(async () => {
            // check no created entries
            expect(
              await db.query.itemValidationsTable.findMany({
                where: eq(itemValidationsTable.itemId, item.id),
              }),
            ).toHaveLength(0);
            res(true);
          }, VALIDATION_LOADING_TIME);
        });
      });

      it('Throws if has write permission', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ memberships: [{ permission: 'write', account: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait for validation to happen before checking nothing was created
        await new Promise((res) => {
          setTimeout(async () => {
            // check no created entries
            expect(
              await db.query.itemValidationsTable.findMany({
                where: eq(itemValidationsTable.itemId, item.id),
              }),
            ).toHaveLength(0);
            res(true);
          }, VALIDATION_LOADING_TIME);
        });
      });

      it('Bad request if id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const mock = jest.spyOn(ItemValidationService.prototype, 'post');

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/validate`,
        });
        expect(res.statusCode).toBe(StatusCodes.ACCEPTED);

        // wait for validation to happen before checking nothing was created
        await new Promise((res) => {
          setTimeout(async () => {
            // check no created entries
            expect(mock).not.toHaveBeenCalled();
            res(true);
          }, VALIDATION_LOADING_TIME);
        });
      });
    });
  });
});
