import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import {
  DiscriminatedItem,
  GuestFactory,
  HttpMethod,
  ItemLoginSchema,
  ItemLoginSchemaFactory,
  ItemLoginSchemaType,
  ItemTagType,
  PermissionLevel,
} from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate } from '../../../../test/app';
import { AppDataSource } from '../../../plugins/datasource';
import { assertIsDefined } from '../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../utils/config';
import { MemberCannotAdminItem } from '../../../utils/errors';
import { MemberPassword } from '../../auth/plugins/password/entities/password';
import { encryptPassword } from '../../auth/plugins/password/utils';
import { Item } from '../../item/entities/Item';
import { ItemTag } from '../../item/plugins/itemTag/ItemTag';
import { ItemTestUtils } from '../../item/test/fixtures/items';
import { Member } from '../../member/entities/member';
import { expectMinimalMember, saveMember } from '../../member/test/fixtures/members';
import { Guest } from '../entities/guest';
import { ItemLoginSchema as ItemLoginSchemaEntity } from '../entities/itemLoginSchema';
import { CannotNestItemLoginSchema, ValidMemberSession } from '../errors';
import { USERNAME_LOGIN } from './fixtures';

const testUtils = new ItemTestUtils();
const rawRepository = AppDataSource.getRepository(Guest);
const rawMemberPasswordRepository = AppDataSource.getRepository(MemberPassword);
const rawItemLoginRepository = AppDataSource.getRepository(Guest);
const rawItemLoginSchemaRepository = AppDataSource.getRepository(ItemLoginSchemaEntity);
const rawItemTagRepository = AppDataSource.getRepository(ItemTag);

export async function saveItemLoginSchema({
  item,
  type = ItemLoginSchemaType.Username,
  password,
  memberName,
}: {
  item: DiscriminatedItem;
  type?: ItemLoginSchemaType;
  password?: string;
  memberName?: string;
}) {
  const itemLoginSchema = ItemLoginSchemaFactory({
    item,
    type,
  });
  const rawItemLoginSchema = await rawItemLoginSchemaRepository.save(itemLoginSchema);
  let guest: Guest | undefined;
  if (memberName) {
    const guestF = GuestFactory({ name: memberName, itemLoginSchema });
    guest = await rawRepository.save(guestF);

    if (password) {
      const hashedPassword = await encryptPassword(password);
      await rawMemberPasswordRepository.save({ member: guest, password: hashedPassword });
    }
  }
  return { itemLoginSchema: rawItemLoginSchema, guest };
}

const expectItemLogin = (member, m) => {
  expectMinimalMember(member, m);
};

describe('Item Login Tests', () => {
  let app: FastifyInstance;
  let actor: Member | undefined | null;
  let item: Item | null;
  let member: Member | null;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    item = null;
    member = null;
    app.close();
  });

  describe('GET /:id/login-schema-type', () => {
    it('Get item login if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      ({ item } = await testUtils.saveItemAndMembership({ member }));
      const { itemLoginSchema } = await saveItemLoginSchema({
        item: item as unknown as DiscriminatedItem,
      });

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.body).toEqual(itemLoginSchema.type);
    });

    it('Get item login if item is hidden', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      ({ item } = await testUtils.saveItemAndMembership({ member }));
      await rawItemTagRepository.save({ item, creator: member, type: ItemTagType.Hidden });
      await saveItemLoginSchema({
        item: item as unknown as DiscriminatedItem,
      });

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('Get item login if item is hidden with read permission', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      ({ item } = await testUtils.saveItemAndMembership({ member }));
      await rawItemTagRepository.save({ item, creator: member, type: ItemTagType.Hidden });
      await saveItemLoginSchema({
        item: item as unknown as DiscriminatedItem,
      });

      const reader = await saveMember();
      await testUtils.saveMembership({ item, account: reader, permission: PermissionLevel.Read });
      mockAuthenticate(reader);

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('Get item login if item is hidden with write permission', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      ({ item } = await testUtils.saveItemAndMembership({ member }));
      await rawItemTagRepository.save({ item, creator: member, type: ItemTagType.Hidden });
      await saveItemLoginSchema({
        item: item as unknown as DiscriminatedItem,
      });

      const writer = await saveMember();
      await testUtils.saveMembership({ item, account: writer, permission: PermissionLevel.Write });
      mockAuthenticate(writer);

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
    });

    it('Get item login if signed out for child', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      ({ item } = await testUtils.saveItemAndMembership({ member }));
      const { itemLoginSchema } = await saveItemLoginSchema({
        item: item as unknown as DiscriminatedItem,
      });
      const child = await testUtils.saveItem({ parentItem: item });

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
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      ({ item } = await testUtils.saveItemAndMembership({ member }));
      await saveItemLoginSchema({ item: item as unknown as DiscriminatedItem });

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
      });

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let itemLoginSchema: ItemLoginSchema;

      beforeEach(async () => {
        ({ app, actor } = await build());
        const member = await saveMember();
        ({ item } = await testUtils.saveItemAndMembership({ member }));
        ({ itemLoginSchema } = await saveItemLoginSchema({
          item: item as unknown as DiscriminatedItem,
        }));
      });

      it('Successfully get item login', async () => {
        assertIsDefined(item);
        assertIsDefined(actor);
        await testUtils.saveMembership({ item, account: actor, permission: PermissionLevel.Admin });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expect(result.id).toEqual(itemLoginSchema.id);
        expect(result.type).toEqual(itemLoginSchema.type);
        expect(result.item.id).toEqual(itemLoginSchema.item.id);
      });

      it('Successfully get item login defined in parent when calling from child for child ', async () => {
        assertIsDefined(item);
        assertIsDefined(actor);
        await testUtils.saveMembership({ item, account: actor, permission: PermissionLevel.Admin });
        const child = await testUtils.saveItem({ parentItem: item, actor });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${child.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expect(result.id).toEqual(itemLoginSchema.id);
        expect(result.type).toEqual(itemLoginSchema.type);
        expect(result.item.id).toEqual(itemLoginSchema.item.id);
      });

      it('Throws if has Write permission', async () => {
        assertIsDefined(item);
        assertIsDefined(actor);
        await testUtils.saveMembership({ item, account: actor, permission: PermissionLevel.Write });
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
      beforeEach(async () => {
        ({ app, actor } = await build());
        const member = await saveMember();
        ({ item } = await testUtils.saveItemAndMembership({ member }));
        await saveItemLoginSchema({ item: item as unknown as DiscriminatedItem });
      });

      it('Cannot item login if already signed in', async () => {
        assertIsDefined(item);
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
          payload: { username: faker.internet.userName() },
        });
        expect(res.json()).toMatchObject(new ValidMemberSession(expect.anything()));
      });
    });

    describe('ItemLoginSchemaType.Username', () => {
      describe('Signed Out', () => {
        beforeEach(async () => {
          ({ app } = await build({ member: null }));
          member = await saveMember();
          ({ item } = await testUtils.saveItemAndMembership({ member }));
        });

        // TODO
        // it('Generate tokens for mobile', async () => {
        //   const payload = MEMBER_ID_LOGIN;
        //   const result = { id: v4(), name: 'myname' };

        //   const res = await app.inject({
        //     method: HttpMethod.POST,
        //     url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login?m=true`,
        //     payload,
        //   });

        //   // expect(generateAuthTokensPair).toHaveBeenCalled();
        //   expect(res.json()).toEqual(result);
        //   expect(res.statusCode).toBe(StatusCodes.OK);
        // });

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
            assertIsDefined(item);
            const payload = USERNAME_LOGIN;
            await saveItemLoginSchema({ item: item as unknown as DiscriminatedItem });
            expect(await rawItemLoginRepository.count()).toEqual(0);

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expect(res.json().name).toEqual(payload.username);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });

          it('Successfully reuse item login with username', async () => {
            assertIsDefined(item);
            const payload = USERNAME_LOGIN;
            // pre-create pseudonymized data
            const { guest: m } = await saveItemLoginSchema({
              item: item as unknown as DiscriminatedItem,
              memberName: payload.username,
            });

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            const member = res.json();
            expectItemLogin(member, m);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });

          it('Successfully reuse item login with username defined in parent when calling from child', async () => {
            assertIsDefined(item);
            const payload = USERNAME_LOGIN;
            // pre-create pseudonymized data
            const { guest: m } = await saveItemLoginSchema({
              item: item as unknown as DiscriminatedItem,
              memberName: payload.username,
            });
            const child = await testUtils.saveItem({ parentItem: item });

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${child.id}/login`,
              payload,
            });

            const member = res.json();
            expectItemLogin(member, m);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });
        });
      });
    });

    describe('ItemLoginSchemaType.UsernameAndPassword', () => {
      const payload = { ...USERNAME_LOGIN, password: 'password' };

      describe('Signed Out', () => {
        beforeEach(async () => {
          ({ app } = await build({ member: null }));
          member = await saveMember();
          ({ item } = await testUtils.saveItemAndMembership({ member }));
        });

        // TODO
        // it('Generate tokens for mobile', async () => {
        //   const payload = MEMBER_ID_LOGIN;
        //   const result = { id: v4(), name: 'myname' };

        //   const res = await app.inject({
        //     method: HttpMethod.POST,
        //     url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login?m=true`,
        //     payload,
        //   });

        //   // expect(generateAuthTokensPair).toHaveBeenCalled();
        //   expect(res.json()).toEqual(result);
        //   expect(res.statusCode).toBe(StatusCodes.OK);
        // });

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
            assertIsDefined(item);
            await saveItemLoginSchema({
              item: item as unknown as DiscriminatedItem,
              type: ItemLoginSchemaType.UsernameAndPassword,
              password: payload.password,
            });
            expect(await rawItemLoginRepository.count()).toEqual(0);

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expect(res.json().name).toEqual(payload.username);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });

          it('Successfully reuse item login with username and password', async () => {
            assertIsDefined(item);
            // pre-create pseudonymized data
            const { guest: m } = await saveItemLoginSchema({
              item: item as unknown as DiscriminatedItem,
              memberName: payload.username,
              type: ItemLoginSchemaType.UsernameAndPassword,
              password: payload.password,
            });

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expectItemLogin(res.json(), m);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });

          it('Throws if item login with username and wrong password', async () => {
            assertIsDefined(item);
            await saveItemLoginSchema({
              item: item as unknown as DiscriminatedItem,
              type: ItemLoginSchemaType.UsernameAndPassword,
              password: payload.password,
            });
            expect(await rawItemLoginRepository.count()).toEqual(0);

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expect(res.json().name).toEqual(payload.username);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });
        });
      });
    });
  });

  describe('PUT /:id/login-schema', () => {
    const payload = {
      type: ItemLoginSchemaType.UsernameAndPassword,
    };

    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      ({ item } = await testUtils.saveItemAndMembership({ member }));

      const res = await app.inject({
        method: HttpMethod.Put,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        payload,
      });

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await testUtils.saveItemAndMembership({ member: actor }));
        await saveItemLoginSchema({ item: item as unknown as DiscriminatedItem });
      });

      it('Successfully change item login schema', async () => {
        assertIsDefined(item);
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
          payload,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject(payload);
      });

      it('Cannot change item login schema if have write permission', async () => {
        assertIsDefined(actor);
        // save new item with wanted memberships
        const { item: item1 } = await testUtils.saveItemAndMembership({
          member: actor,
          permission: PermissionLevel.Write,
        });

        await saveItemLoginSchema({ item: item1 as unknown as DiscriminatedItem });

        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item1.id}/login-schema`,
          payload,
        });

        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Cannot put item login schema if is inherited', async () => {
        assertIsDefined(item);
        // save new item with wanted memberships
        const child = await testUtils.saveItem({ parentItem: item, actor });

        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${child.id}/login-schema`,
          payload,
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
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();
      ({ item } = await testUtils.saveItemAndMembership({ member }));
      await saveItemLoginSchema({ item: item as unknown as DiscriminatedItem });

      const res = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
      });

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let itemLoginSchema: ItemLoginSchema;

      beforeEach(async () => {
        ({ app, actor } = await build());
        const member = await saveMember();
        ({ item } = await testUtils.saveItemAndMembership({ member }));
        ({ itemLoginSchema } = await saveItemLoginSchema({
          item: item as unknown as DiscriminatedItem,
        }));
      });

      it('Successfully delete item login', async () => {
        assertIsDefined(item);
        assertIsDefined(actor);
        await testUtils.saveMembership({ item, account: actor, permission: PermissionLevel.Admin });
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.body).toEqual(itemLoginSchema.id);
        expect(await rawItemLoginSchemaRepository.findOneBy({ id: itemLoginSchema.id })).toBeNull();
      });

      it('Throws if has Write permission', async () => {
        assertIsDefined(item);
        assertIsDefined(actor);
        await testUtils.saveMembership({ item, account: actor, permission: PermissionLevel.Write });
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        });

        expect(res.json()).toMatchObject(new MemberCannotAdminItem(item.id));
      });

      it('Throws if id is not valid', async () => {
        const id = 'invalid-id';

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
