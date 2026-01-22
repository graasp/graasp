import { faker } from '@faker-js/faker';
import { and, eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, ItemLoginSchemaStatus, ItemLoginSchemaType } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { guestsView, itemLoginSchemasTable, itemMembershipsTable } from '../../drizzle/schema';
import { assertIsDefined } from '../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../utils/config';
import { MemberCannotAdminItem } from '../../utils/errors';
import { assertIsMemberForTest } from '../authentication';
import { CannotNestItemLoginSchema, ValidMemberSession } from './errors';

const getGuest = async ({
  name,
  itemLoginSchemaId,
}: {
  name: string;
  itemLoginSchemaId?: string;
}) => {
  const conditions = [eq(guestsView.name, name)];
  if (itemLoginSchemaId) {
    conditions.push(eq(guestsView.itemLoginSchemaId, itemLoginSchemaId));
  }
  return (
    await db
      .select()
      .from(guestsView)
      .where(and(...conditions))
  )[0];
};

const getItemLoginSchemaById = async (ilsId: string) => {
  return await db.query.itemLoginSchemasTable.findFirst({
    where: eq(itemLoginSchemasTable.id, ilsId),
  });
};

describe('Item Login Tests', () => {
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

  describe('GET /api/items/:id/login-schema-type', () => {
    it('Get item login if signed out', async () => {
      const {
        items: [item],
        itemLoginSchemas: [itemLoginSchema],
      } = await seedFromJson({ actor: null, items: [{ itemLoginSchema: {} }] });

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.body).toEqual(itemLoginSchema.type);
    });

    it('Cannot get item login type if disabled', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            itemLoginSchema: {
              status: ItemLoginSchemaStatus.Disabled,
            },
          },
        ],
      });

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.body).toBe('null');
    });

    it('Cannot get item login if item is hidden', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            isHidden: true,
            itemLoginSchema: {},
          },
        ],
      });

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('Cannot get item login if item is hidden with read permission', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            isHidden: true,
            itemLoginSchema: {},
            memberships: [{ account: 'actor', permission: 'read' }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('Get item login if item is hidden with write permission', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            isHidden: true,
            itemLoginSchema: {},
            memberships: [{ account: 'actor', permission: 'write' }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
    });

    it('Get item login if signed out for child', async () => {
      const {
        items: [_parentItem, child],
        itemLoginSchemas: [itemLoginSchema],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            itemLoginSchema: {},
            children: [{}],
          },
        ],
      });

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${child.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.body).toEqual(itemLoginSchema.type);
    });
  });

  describe('GET /:id/login-schema', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            itemLoginSchema: {},
          },
        ],
      });

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
      });

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Successfully get item login', async () => {
        const {
          actor,
          items: [item],
          itemLoginSchemas: [itemLoginSchema],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              itemLoginSchema: {},
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expect(result.id).toEqual(itemLoginSchema.id);
        expect(result.type).toEqual(itemLoginSchema.type);
        expect(result.status).toEqual(itemLoginSchema.status);
        expect(result.item.id).toEqual(item.id);
      });

      it('Successfully get frozen item login', async () => {
        const {
          actor,
          items: [item],
          itemLoginSchemas: [itemLoginSchema],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              itemLoginSchema: { status: ItemLoginSchemaStatus.Freeze },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expect(result.id).toEqual(itemLoginSchema.id);
        expect(result.type).toEqual(itemLoginSchema.type);
        expect(result.status).toEqual(itemLoginSchema.status);
        expect(result.item.id).toEqual(item.id);
      });
      it('Successfully get disabled item login', async () => {
        const {
          actor,
          items: [item],
          itemLoginSchemas: [itemLoginSchema],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              itemLoginSchema: { status: ItemLoginSchemaStatus.Disabled },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expect(result.id).toEqual(itemLoginSchema.id);
        expect(result.type).toEqual(itemLoginSchema.type);
        expect(result.status).toEqual(itemLoginSchema.status);
        expect(result.item.id).toEqual(item.id);
      });

      it('Successfully get item login defined in parent when calling from child for child', async () => {
        const {
          actor,
          items: [parentItem, child],
          itemLoginSchemas: [itemLoginSchema],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              itemLoginSchema: {},
              children: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${child.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expect(result.id).toEqual(itemLoginSchema.id);
        expect(result.type).toEqual(itemLoginSchema.type);
        expect(result.status).toEqual(itemLoginSchema.status);
        expect(result.item.id).toEqual(parentItem.id);
      });

      it('Return no content if item does not have item login schema', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
      });

      it('Throws if has Write permission', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'write' }],
              itemLoginSchema: {},
              children: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        });

        expect(res.json()).toMatchObject(new MemberCannotAdminItem(item.id));
      });

      it('Throws if id is not valid', async () => {
        const id = 'invalid-id';

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('POST /:id/login', () => {
    describe('Signed In', () => {
      it('Cannot item login if already signed in', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              itemLoginSchema: {},
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
          payload: { username: faker.internet.username() },
        });
        expect(res.json()).toMatchObject(new ValidMemberSession(expect.anything()));
      });
    });

    describe('ItemLogin Schema Status', () => {
      it('Cannot register in frozen ItemLogin', async () => {
        const {
          items: [item],
        } = await seedFromJson({
          actor: null,
          items: [
            {
              itemLoginSchema: { status: ItemLoginSchemaStatus.Freeze },
            },
          ],
        });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
          payload: { username: 'username' },
        });

        expect(res.statusCode).toBe(StatusCodes.FORBIDDEN);
      });

      it('Login in frozen ItemLogin', async () => {
        const {
          items: [item],
          guests: [guest],
        } = await seedFromJson({
          actor: null,
          items: [
            {
              itemLoginSchema: { status: ItemLoginSchemaStatus.Freeze, guests: [{}] },
            },
          ],
        });
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
          payload: { username: guest.name },
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const member = res.json();
        expect(member).toBeDefined();
      });

      it('Cannot register in Disabled ItemLogin', async () => {
        const {
          items: [item],
        } = await seedFromJson({
          actor: null,
          items: [
            {
              itemLoginSchema: { status: ItemLoginSchemaStatus.Disabled },
            },
          ],
        });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
          payload: { username: 'new' },
        });

        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      });

      it('Cannot log in in disabled ItemLogin', async () => {
        const {
          items: [item],
          guests: [guest],
        } = await seedFromJson({
          actor: null,
          items: [
            {
              itemLoginSchema: { status: ItemLoginSchemaStatus.Disabled, guests: [{}] },
            },
          ],
        });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
          payload: { username: guest.name },
        });

        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
    });

    describe('ItemLogin from child', () => {
      it('Successfully register when item login is defined in parent', async () => {
        const {
          items: [parentItem, child],
        } = await seedFromJson({
          actor: null,
          items: [
            {
              itemLoginSchema: {},
              children: [{}],
            },
          ],
        });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${child.id}/login`,
          payload: { username: 'newuser' },
        });

        const member = res.json();

        // membership is saved on the right path
        const membership = await db.query.itemMembershipsTable.findFirst({
          where: eq(itemMembershipsTable.accountId, member.id),
          with: { item: true, account: true },
        });
        expect(membership?.item.path).toEqual(parentItem.path);

        expect(res.statusCode).toBe(StatusCodes.OK);
      });
    });

    describe('ItemLoginSchemaType.Username', () => {
      describe('Signed Out', () => {
        it('Throws if item id is not valid', async () => {
          const id = 'invalid-id';

          const res = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/${id}/login`,
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        describe('Username', () => {
          it('Successfully create item login with username', async () => {
            const {
              items: [item],
              itemLoginSchemas: [ils],
            } = await seedFromJson({
              items: [
                {
                  itemLoginSchema: {},
                  memberships: [{ account: { name: 'bob' }, permission: 'admin' }],
                },
              ],
            });
            const payload = { username: 'username' };

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expect(res.statusCode).toBe(StatusCodes.OK);
            const guestInDb = await getGuest({ name: payload.username, itemLoginSchemaId: ils.id });
            expect(guestInDb.lastAuthenticatedAt).toBeDefined();
            expect(res.json().name).toEqual(payload.username);
          });

          it('Successfully reuse item login with username', async () => {
            const {
              items: [item],
              guests: [guest],
              itemLoginSchemas: [itemLoginSchema],
            } = await seedFromJson({
              actor: null,
              items: [
                {
                  itemLoginSchema: {
                    guests: [
                      {
                        lastAuthenticatedAt: new Date(
                          Date.now() - 24 * 60 * 60 * 1000,
                        ).toISOString(),
                      },
                    ],
                  },
                },
              ],
            });

            assertIsDefined(guest);

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload: { username: guest.name },
            });

            expect(res.statusCode).toBe(StatusCodes.OK);
            const member = res.json();
            expect(member.name).toEqual(guest.name);
            expect(member.id).toEqual(guest.id);

            const guestInDb = await getGuest({
              name: guest.name,
              itemLoginSchemaId: itemLoginSchema.id,
            });
            // last authenticated got updated
            assertIsDefined(guestInDb.lastAuthenticatedAt);
            assertIsDefined(guest.lastAuthenticatedAt);
            expect(
              new Date(guestInDb.lastAuthenticatedAt) > new Date(guest.lastAuthenticatedAt),
            ).toEqual(true);
            // last authenticated is within last minute
            expect(
              new Date(guestInDb.lastAuthenticatedAt) > new Date(Date.now() - 60 * 1000),
            ).toEqual(true);
          });

          it('Successfully reuse item login with username defined in parent when calling from child', async () => {
            const {
              items: [_parentItem, child],
              guests: [guest],
            } = await seedFromJson({
              actor: null,
              items: [
                {
                  itemLoginSchema: {
                    guests: [{}],
                  },
                  children: [{}],
                },
              ],
            });

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${child.id}/login`,
              payload: { username: guest.name },
            });

            const member = res.json();
            expect(member.name).toEqual(guest.name);
            expect(member.id).toEqual(guest.id);

            expect(res.statusCode).toBe(StatusCodes.OK);
          });
        });
      });
    });

    describe('ItemLoginSchemaType.UsernameAndPassword', () => {
      describe('Signed Out', () => {
        it('Throws if item id is not valid', async () => {
          const id = 'invalid-id';

          const res = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/${id}/login`,
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        describe('Username', () => {
          it('Successfully create item login with username and password', async () => {
            const {
              items: [item],
            } = await seedFromJson({
              actor: null,
              items: [
                {
                  itemLoginSchema: {
                    type: ItemLoginSchemaType.UsernameAndPassword,
                  },
                },
              ],
            });

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload: { username: 'username', password: 'password' },
            });

            expect(res.json().name).toEqual('username');
            expect(res.statusCode).toBe(StatusCodes.OK);
          });

          it('Successfully reuse item login with username and password', async () => {
            const {
              items: [item],
              guests: [guest],
            } = await seedFromJson({
              actor: null,
              items: [
                {
                  itemLoginSchema: {
                    type: ItemLoginSchemaType.UsernameAndPassword,
                    guests: [{ name: 'bob', password: 'alice' }],
                  },
                },
              ],
            });

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload: { username: 'bob', password: 'alice' },
            });
            expect(res.statusCode).toBe(StatusCodes.OK);
            const member = await res.json();
            expect(member.name).toEqual(guest.name);
            expect(member.id).toEqual(guest.id);
          });

          it('Throws if item login with username and wrong password', async () => {
            const {
              items: [item],
              guests: [guest],
            } = await seedFromJson({
              actor: null,
              items: [
                {
                  itemLoginSchema: {
                    type: ItemLoginSchemaType.UsernameAndPassword,
                    guests: [{ name: 'bob', password: 'alice' }],
                  },
                },
              ],
            });

            // login again with wrong password - should throw
            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload: { username: guest.name, password: 'wrong' },
            });

            expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
          });
        });
      });
    });
  });

  describe('PUT /:id/login-schema', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            itemLoginSchema: {
              type: ItemLoginSchemaType.UsernameAndPassword,
            },
          },
        ],
      });

      const res = await app.inject({
        method: HttpMethod.Put,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        payload: { username: 'username', password: 'password' },
      });

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Successfully change type of item login schema', async () => {
        const {
          actor,
          items: [item],
          itemLoginSchemas: [ils],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              itemLoginSchema: {
                type: ItemLoginSchemaType.UsernameAndPassword,
              },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
          payload: { type: ItemLoginSchemaType.Username },
        });

        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
        const itemLoginSchema = await getItemLoginSchemaById(ils.id);
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(ItemLoginSchemaType.Username);
        expect(itemLoginSchema.status).toEqual(ItemLoginSchemaStatus.Active);
      });

      it('Successfully change type of frozen item login schema', async () => {
        const {
          actor,
          items: [item],
          itemLoginSchemas: [ils],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              itemLoginSchema: {
                type: ItemLoginSchemaType.UsernameAndPassword,
                status: ItemLoginSchemaStatus.Freeze,
              },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const newType = ItemLoginSchemaType.Username;
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
          payload: { type: newType },
        });

        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
        const itemLoginSchema = await getItemLoginSchemaById(ils.id);
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(newType);
        expect(itemLoginSchema.status).toEqual(ItemLoginSchemaStatus.Freeze);
      });
      it('Successfully change type of disabled item login schema', async () => {
        const {
          actor,
          items: [item],
          itemLoginSchemas: [ils],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              itemLoginSchema: {
                type: ItemLoginSchemaType.UsernameAndPassword,
                status: ItemLoginSchemaStatus.Disabled,
              },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const newType = ItemLoginSchemaType.Username;
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
          payload: { type: newType },
        });

        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
        const itemLoginSchema = await getItemLoginSchemaById(ils.id);
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(newType);
        expect(itemLoginSchema.status).toEqual(ItemLoginSchemaStatus.Disabled);
      });

      it('Successfully change status of item login schema', async () => {
        const {
          actor,
          items: [item],
          itemLoginSchemas: [ils],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              itemLoginSchema: {
                status: ItemLoginSchemaStatus.Active,
                type: ItemLoginSchemaType.Username,
              },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const newStatus = ItemLoginSchemaStatus.Freeze;
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
          payload: { status: newStatus },
        });

        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
        const itemLoginSchema = await getItemLoginSchemaById(ils.id);
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(ItemLoginSchemaType.Username);
        expect(itemLoginSchema.status).toEqual(newStatus);
      });

      it('Successfully change status and type of item login schema', async () => {
        const {
          actor,
          items: [item],
          itemLoginSchemas: [ils],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              itemLoginSchema: {
                type: ItemLoginSchemaType.Username,
                status: ItemLoginSchemaStatus.Active,
              },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const newPayload = {
          status: ItemLoginSchemaStatus.Disabled,
          type: ItemLoginSchemaType.UsernameAndPassword,
        };
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
          payload: newPayload,
        });

        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
        const itemLoginSchema = await getItemLoginSchemaById(ils.id);
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(newPayload.type);
        expect(itemLoginSchema.status).toEqual(newPayload.status);
      });

      it('Cannot change item login schema if have write permission', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'write' }],
              itemLoginSchema: {},
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
          payload: { status: ItemLoginSchemaStatus.Freeze },
        });

        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Cannot put item login schema if is inherited', async () => {
        const {
          actor,
          items: [_parentItem, child],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              itemLoginSchema: {},
              children: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${child.id}/login-schema`,
          payload: { status: ItemLoginSchemaStatus.Freeze },
        });

        expect(res.json()).toMatchObject(new CannotNestItemLoginSchema(expect.anything()));
      });

      it('Throws if id is invalid', async () => {
        const id = 'valid-id';
        const payload = {
          loginSchema: ItemLoginSchemaType.UsernameAndPassword,
        };

        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${id}/login-schema`,
          payload,
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if login schema is invalid', async () => {
        const id = 'valid-id';
        const payload = {
          loginSchema: 'login-schema',
        };

        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${id}/login-schema`,
          payload,
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
  describe('DELETE /:id/login-schema', () => {
    describe('Schema Validation', () => {
      it('Throws if id is invalid', async () => {
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });

    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            memberships: [{ account: { name: 'bob' }, permission: 'admin' }],
            itemLoginSchema: {},
          },
        ],
      });

      const res = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
      });

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Successfully delete item login schema', async () => {
        const {
          actor,
          items: [item],
          guests: [guest],
          itemLoginSchemas: [ils],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              itemLoginSchema: { guests: [{}] },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        expect(await getGuest({ name: guest.name })).toBeDefined();

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        });
        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);

        // item login schema should not exist anymore
        const itemLoginSchema = await getItemLoginSchemaById(ils.id);
        expect(itemLoginSchema).toBeUndefined();

        // related item login should be deleted
        expect(await getGuest({ name: guest.name })).toBeUndefined();
      });

      it('Cannot delete item login schema if have write permission', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'write' }],
              itemLoginSchema: { guests: [{}] },
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        });

        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });
    });
  });
});
