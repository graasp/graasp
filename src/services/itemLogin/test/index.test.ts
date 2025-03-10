import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import {
  HttpMethod,
  ItemLoginSchemaStatus,
  ItemLoginSchemaType,
  PermissionLevel,
} from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../../test/app';
import { seedFromJson } from '../../../../test/mocks/seed';
import { AppDataSource } from '../../../plugins/datasource';
import { assertIsDefined } from '../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../utils/config';
import { MemberCannotAdminItem } from '../../../utils/errors';
import { Account } from '../../account/entities/account';
import { ItemMembership } from '../../itemMembership/entities/ItemMembership';
import { expectAccount } from '../../member/test/fixtures/members';
import { Guest } from '../entities/guest';
import { ItemLoginSchema as ItemLoginSchemaEntity } from '../entities/itemLoginSchema';
import { CannotNestItemLoginSchema, ValidMemberSession } from '../errors';

const rawGuestRepository = AppDataSource.getRepository(Guest);
const rawItemMembershipRepository = AppDataSource.getRepository(ItemMembership);
const rawItemLoginSchemaRepository = AppDataSource.getRepository(ItemLoginSchemaEntity);

const expectItemLogin = (member: AccountRaw, m: AccountRaw) => {
  expectAccount(member, m);
};

describe('Item Login Tests', () => {
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

  describe('GET /:id/login-schema-type', () => {
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
            memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
          },
        ],
      });
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
            memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
          },
        ],
      });
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              itemLoginSchema: {},
            },
          ],
        });
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              itemLoginSchema: { status: ItemLoginSchemaStatus.Freeze },
            },
          ],
        });
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              itemLoginSchema: { status: ItemLoginSchemaStatus.Disabled },
            },
          ],
        });
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

      it('Successfully get item login defined in parent when calling from child for child ', async () => {
        const {
          actor,
          items: [parentItem, child],
          itemLoginSchemas: [itemLoginSchema],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              itemLoginSchema: {},
              children: [{}],
            },
          ],
        });
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

      it('Throws if has Write permission', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              itemLoginSchema: {},
              children: [{}],
            },
          ],
        });
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
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
          payload: { username: faker.internet.userName() },
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
        const membership = await rawItemMembershipRepository.findOne({
          where: { account: { id: member.id } },
          relations: { item: true, account: true },
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
            } = await seedFromJson({
              items: [
                {
                  itemLoginSchema: {},
                  memberships: [{ account: { name: 'bob' }, permission: PermissionLevel.Admin }],
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
            const guestInDb = await rawGuestRepository.findBy({
              name: payload.username,
              itemLoginSchema: { item: { path: item.path } },
            });
            expect(guestInDb).toHaveLength(1);
            expect(guestInDb[0].lastAuthenticatedAt).toBeDefined();
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
                        lastAuthenticatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
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
            expectItemLogin(member, guest);

            const guestInDb = await rawGuestRepository.findBy({
              name: guest.name,
              itemLoginSchema: { id: itemLoginSchema.id },
            });
            expect(guestInDb).toHaveLength(1);
            // last authenticated got updated
            expect(
              new Date(guestInDb[0].lastAuthenticatedAt) > new Date(guest.lastAuthenticatedAt),
            ).toEqual(true);
            // last authenticated is within last minute
            expect(
              new Date(guestInDb[0].lastAuthenticatedAt) > new Date(Date.now() - 60 * 1000),
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
            expectItemLogin(member, guest);

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
            expectItemLogin(res.json(), guest);
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
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              itemLoginSchema: {
                type: ItemLoginSchemaType.UsernameAndPassword,
              },
            },
          ],
        });
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
          payload: { type: ItemLoginSchemaType.Username },
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const itemLoginSchema = await rawItemLoginSchemaRepository.findOneBy({
          item: { id: item.id },
        });
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(ItemLoginSchemaType.Username);
        expect(itemLoginSchema.status).toEqual(ItemLoginSchemaStatus.Active);
      });

      it('Successfully change type of frozen item login schema', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              itemLoginSchema: {
                type: ItemLoginSchemaType.UsernameAndPassword,
                status: ItemLoginSchemaStatus.Freeze,
              },
            },
          ],
        });
        mockAuthenticate(actor);

        const newType = ItemLoginSchemaType.Username;
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
          payload: { type: newType },
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json().type).toEqual(newType);
        const itemLoginSchema = await rawItemLoginSchemaRepository.findOneBy({
          item: { id: item.id },
        });
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(newType);
        expect(itemLoginSchema.status).toEqual(ItemLoginSchemaStatus.Freeze);
      });
      it('Successfully change type of disabled item login schema', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              itemLoginSchema: {
                type: ItemLoginSchemaType.UsernameAndPassword,
                status: ItemLoginSchemaStatus.Disabled,
              },
            },
          ],
        });
        mockAuthenticate(actor);

        const newType = ItemLoginSchemaType.Username;
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
          payload: { type: newType },
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json().type).toEqual(newType);
        const itemLoginSchema = await rawItemLoginSchemaRepository.findOneBy({
          item: { id: item.id },
        });
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(newType);
        expect(itemLoginSchema.status).toEqual(ItemLoginSchemaStatus.Disabled);
      });

      it('Successfully change status of item login schema', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              itemLoginSchema: {
                status: ItemLoginSchemaStatus.Active,
                type: ItemLoginSchemaType.Username,
              },
            },
          ],
        });
        mockAuthenticate(actor);

        const newStatus = ItemLoginSchemaStatus.Freeze;
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
          payload: { status: newStatus },
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json().status).toEqual(newStatus);
        const itemLoginSchema = await rawItemLoginSchemaRepository.findOneBy({
          item: { id: item.id },
        });
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(ItemLoginSchemaType.Username);
        expect(itemLoginSchema.status).toEqual(newStatus);
      });

      it('Successfully change status and type of item login schema', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              itemLoginSchema: {
                type: ItemLoginSchemaType.Username,
                status: ItemLoginSchemaStatus.Active,
              },
            },
          ],
        });
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

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject(newPayload);
        const itemLoginSchema = await rawItemLoginSchemaRepository.findOneBy({
          item: { id: item.id },
        });
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              itemLoginSchema: {},
            },
          ],
        });
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
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              itemLoginSchema: {},
              children: [{}],
            },
          ],
        });
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
            memberships: [{ account: { name: 'bob' }, permission: PermissionLevel.Admin }],
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
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
              itemLoginSchema: { guests: [{}] },
            },
          ],
        });
        mockAuthenticate(actor);

        expect(await rawGuestRepository.findOneBy({ name: guest.name })).toBeDefined();

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);

        // item login schema should not exist anymore
        const itemLoginSchema = await rawItemLoginSchemaRepository.findOneBy({
          item: { id: item.id },
        });
        expect(itemLoginSchema).toBeNull();

        // related item login should be deleted
        expect(await rawGuestRepository.findOneBy({ name: guest.name })).toBeNull();
      });

      it('Cannot delete item login schema if have write permission', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
              itemLoginSchema: { guests: [{}] },
            },
          ],
        });
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
