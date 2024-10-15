import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import {
  DiscriminatedItem,
  GuestFactory,
  HttpMethod,
  ItemLoginSchema,
  ItemLoginSchemaFactory,
  ItemLoginSchemaStatus,
  ItemLoginSchemaType,
  ItemTagType,
  PermissionLevel,
} from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../../test/app';
import { AppDataSource } from '../../../plugins/datasource';
import { assertIsDefined } from '../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../utils/config';
import { MemberCannotAdminItem } from '../../../utils/errors';
import { encryptPassword } from '../../auth/plugins/password/utils';
import { Item } from '../../item/entities/Item';
import { ItemTag } from '../../item/plugins/itemTag/ItemTag';
import { ItemTestUtils } from '../../item/test/fixtures/items';
import { ItemMembership } from '../../itemMembership/entities/ItemMembership';
import { Member } from '../../member/entities/member';
import { expectMinimalMember, saveMember } from '../../member/test/fixtures/members';
import { Guest } from '../entities/guest';
import { GuestPassword } from '../entities/guestPassword';
import { ItemLoginSchema as ItemLoginSchemaEntity } from '../entities/itemLoginSchema';
import { CannotNestItemLoginSchema, ValidMemberSession } from '../errors';
import { USERNAME_LOGIN } from './fixtures';

const testUtils = new ItemTestUtils();
const rawRepository = AppDataSource.getRepository(Guest);
const rawGuestPasswordRepository = AppDataSource.getRepository(GuestPassword);
const rawItemMembershipRepository = AppDataSource.getRepository(ItemMembership);
const rawItemLoginRepository = AppDataSource.getRepository(Guest);
const rawItemLoginSchemaRepository = AppDataSource.getRepository(ItemLoginSchemaEntity);
const rawItemTagRepository = AppDataSource.getRepository(ItemTag);

export async function saveItemLoginSchema({
  item,
  type = ItemLoginSchemaType.Username,
  status = ItemLoginSchemaStatus.Active,
  password,
  memberName,
}: {
  item: DiscriminatedItem;
  type?: ItemLoginSchemaType;
  status?: ItemLoginSchemaStatus;
  password?: string;
  memberName?: string;
}) {
  const itemLoginSchema = ItemLoginSchemaFactory({
    item,
    type,
    status,
  });
  const rawItemLoginSchema = await rawItemLoginSchemaRepository.save(itemLoginSchema);
  let guest: Guest | undefined;
  if (memberName) {
    const guestF = GuestFactory({ name: memberName, itemLoginSchema });
    guest = await rawRepository.save(guestF);

    if (password) {
      const hashedPassword = await encryptPassword(password);
      await rawGuestPasswordRepository.save({ guest, password: hashedPassword });
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
  let anotherItem: Item | null;
  let member: Member | null;

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
    anotherItem = null;
    member = null;
  });

  describe('GET /:id/login-schema-type', () => {
    it('Get item login if signed out', async () => {
      const member = await saveMember();
      ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
      const { itemLoginSchema } = await saveItemLoginSchema({
        item: anotherItem as unknown as DiscriminatedItem,
      });

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.body).toEqual(itemLoginSchema.type);
    });

    it('Cannot get item login type if disabled', async () => {
      const member = await saveMember();
      ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
      await saveItemLoginSchema({
        item: anotherItem as unknown as DiscriminatedItem,
        status: ItemLoginSchemaStatus.Disabled,
      });

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.body).toBe('null');
    });

    it('Get item login if item is hidden', async () => {
      const member = await saveMember();
      ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
      await rawItemTagRepository.save({
        item: anotherItem,
        creator: member,
        type: ItemTagType.Hidden,
      });
      await saveItemLoginSchema({
        item: anotherItem as unknown as DiscriminatedItem,
      });

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('Get item login if item is hidden with read permission', async () => {
      const member = await saveMember();
      ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
      await rawItemTagRepository.save({
        item: anotherItem,
        creator: member,
        type: ItemTagType.Hidden,
      });
      await saveItemLoginSchema({
        item: anotherItem as unknown as DiscriminatedItem,
      });

      const reader = await saveMember();
      await testUtils.saveMembership({
        item: anotherItem,
        account: reader,
        permission: PermissionLevel.Read,
      });
      mockAuthenticate(reader);

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
    });

    it('Get item login if item is hidden with write permission', async () => {
      const member = await saveMember();
      ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
      await rawItemTagRepository.save({
        item: anotherItem,
        creator: member,
        type: ItemTagType.Hidden,
      });
      await saveItemLoginSchema({
        item: anotherItem as unknown as DiscriminatedItem,
      });

      const writer = await saveMember();
      await testUtils.saveMembership({
        item: anotherItem,
        account: writer,
        permission: PermissionLevel.Write,
      });
      mockAuthenticate(writer);

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema-type`,
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
    });

    it('Get item login if signed out for child', async () => {
      const member = await saveMember();
      ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
      const { itemLoginSchema } = await saveItemLoginSchema({
        item: anotherItem as unknown as DiscriminatedItem,
      });
      const child = await testUtils.saveItem({ parentItem: anotherItem });

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
      const member = await saveMember();
      ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
      await saveItemLoginSchema({ item: anotherItem as unknown as DiscriminatedItem });

      const res = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema`,
      });

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let itemLoginSchema: ItemLoginSchema;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
        const member = await saveMember();
        ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
        ({ itemLoginSchema } = await saveItemLoginSchema({
          item: anotherItem as unknown as DiscriminatedItem,
        }));
      });

      it('Successfully get item login', async () => {
        assertIsDefined(anotherItem);
        assertIsDefined(actor);
        await testUtils.saveMembership({
          item: anotherItem,
          account: actor,
          permission: PermissionLevel.Admin,
        });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expect(result.id).toEqual(itemLoginSchema.id);
        expect(result.type).toEqual(itemLoginSchema.type);
        expect(result.status).toEqual(itemLoginSchema.status);
        expect(result.item.id).toEqual(itemLoginSchema.item.id);
      });

      it('Successfully get frozen item login', async () => {
        assertIsDefined(actor);
        const member = await saveMember();
        ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
        ({ itemLoginSchema } = await saveItemLoginSchema({
          item: anotherItem as unknown as DiscriminatedItem,
          status: ItemLoginSchemaStatus.Freeze,
        }));
        await testUtils.saveMembership({
          item: anotherItem,
          account: actor,
          permission: PermissionLevel.Admin,
        });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expect(result.id).toEqual(itemLoginSchema.id);
        expect(result.type).toEqual(itemLoginSchema.type);
        expect(result.status).toEqual(itemLoginSchema.status);
        expect(result.item.id).toEqual(itemLoginSchema.item.id);
      });
      it('Successfully get disabled item login', async () => {
        assertIsDefined(actor);
        const member = await saveMember();
        ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
        ({ itemLoginSchema } = await saveItemLoginSchema({
          item: anotherItem as unknown as DiscriminatedItem,
          status: ItemLoginSchemaStatus.Disabled,
        }));
        await testUtils.saveMembership({
          item: anotherItem,
          account: actor,
          permission: PermissionLevel.Admin,
        });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expect(result.id).toEqual(itemLoginSchema.id);
        expect(result.type).toEqual(itemLoginSchema.type);
        expect(result.status).toEqual(itemLoginSchema.status);
        expect(result.item.id).toEqual(itemLoginSchema.item.id);
      });

      it('Successfully get item login defined in parent when calling from child for child ', async () => {
        assertIsDefined(anotherItem);
        assertIsDefined(actor);
        await testUtils.saveMembership({
          item: anotherItem,
          account: actor,
          permission: PermissionLevel.Admin,
        });
        const child = await testUtils.saveItem({ parentItem: anotherItem, actor });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${child.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expect(result.id).toEqual(itemLoginSchema.id);
        expect(result.type).toEqual(itemLoginSchema.type);
        expect(result.status).toEqual(itemLoginSchema.status);
        expect(result.item.id).toEqual(itemLoginSchema.item.id);
      });

      it('Throws if has Write permission', async () => {
        assertIsDefined(anotherItem);
        assertIsDefined(actor);
        await testUtils.saveMembership({
          item: anotherItem,
          account: actor,
          permission: PermissionLevel.Write,
        });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema`,
        });

        expect(res.json()).toMatchObject(new MemberCannotAdminItem(anotherItem.id));
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
        actor = await saveMember();
        mockAuthenticate(actor);
        const member = await saveMember();
        ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
        await saveItemLoginSchema({ item: anotherItem as unknown as DiscriminatedItem });
      });

      it('Cannot item login if already signed in', async () => {
        assertIsDefined(anotherItem);
        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login`,
          payload: { username: faker.internet.userName() },
        });
        expect(res.json()).toMatchObject(new ValidMemberSession(expect.anything()));
      });
    });

    describe('ItemLogin Schema Status', () => {
      beforeEach(async () => {
        member = await saveMember();
        ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
      });

      it('Register in ItemLogin', async () => {
        assertIsDefined(anotherItem);
        const payload = USERNAME_LOGIN;
        await saveItemLoginSchema({
          item: anotherItem as unknown as DiscriminatedItem,
          status: ItemLoginSchemaStatus.Freeze,
        });
        expect(await rawItemLoginRepository.count()).toEqual(0);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login`,
          payload,
        });

        expect(res.statusCode).toBe(StatusCodes.FORBIDDEN);
      });

      it('Login in frozen ItemLogin', async () => {
        assertIsDefined(anotherItem);
        const payload = USERNAME_LOGIN;
        // pre-create pseudonymized data
        const { guest: m } = await saveItemLoginSchema({
          item: anotherItem as unknown as DiscriminatedItem,
          memberName: payload.username,
          status: ItemLoginSchemaStatus.Freeze,
        });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login`,
          payload,
        });

        const member = res.json();
        expectItemLogin(member, m);
        expect(res.statusCode).toBe(StatusCodes.OK);
      });

      it('Register in Disabled ItemLogin', async () => {
        assertIsDefined(anotherItem);
        const payload = USERNAME_LOGIN;
        await saveItemLoginSchema({
          item: anotherItem as unknown as DiscriminatedItem,
          status: ItemLoginSchemaStatus.Disabled,
        });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login`,
          payload,
        });

        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      });

      it('Log In Disabled ItemLogin', async () => {
        assertIsDefined(anotherItem);
        const payload = USERNAME_LOGIN;
        // pre-create pseudonymized data
        await saveItemLoginSchema({
          item: anotherItem as unknown as DiscriminatedItem,
          memberName: payload.username,
          status: ItemLoginSchemaStatus.Disabled,
        });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login`,
          payload,
        });

        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      });
    });

    describe('ItemLogin from child', () => {
      it('Successfully register when item login is defined in parent', async () => {
        const payload = USERNAME_LOGIN;
        // pre-create pseudonymized data
        const item = await testUtils.saveItem({});
        const { itemLoginSchema } = await saveItemLoginSchema({
          item: item as unknown as DiscriminatedItem,
        });
        const child = await testUtils.saveItem({ parentItem: item });

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${child.id}/login`,
          payload,
        });

        const member = res.json();

        // membership is saved on the right path
        const membership = await rawItemMembershipRepository.findOne({
          where: { account: { id: member.id } },
          relations: { item: true, account: true },
        });
        expect(membership?.item.path).toEqual(itemLoginSchema.item.path);

        expect(res.statusCode).toBe(StatusCodes.OK);
      });
    });

    describe('ItemLoginSchemaType.Username', () => {
      describe('Signed Out', () => {
        beforeEach(async () => {
          member = await saveMember();
          ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
        });

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
            assertIsDefined(anotherItem);
            const payload = USERNAME_LOGIN;
            await saveItemLoginSchema({ item: anotherItem as unknown as DiscriminatedItem });

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login`,
              payload,
            });

            expect(res.json().name).toEqual(payload.username);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });

          it('Successfully reuse item login with username', async () => {
            assertIsDefined(anotherItem);
            const payload = USERNAME_LOGIN;
            // pre-create pseudonymized data
            const { guest: m } = await saveItemLoginSchema({
              item: anotherItem as unknown as DiscriminatedItem,
              memberName: payload.username,
            });

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login`,
              payload,
            });

            const member = res.json();
            expectItemLogin(member, m);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });

          it('Successfully reuse item login with username defined in parent when calling from child', async () => {
            assertIsDefined(anotherItem);
            const payload = USERNAME_LOGIN;
            // pre-create pseudonymized data
            const { guest: m } = await saveItemLoginSchema({
              item: anotherItem as unknown as DiscriminatedItem,
              memberName: payload.username,
            });
            const child = await testUtils.saveItem({ parentItem: anotherItem });

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
          member = await saveMember();
          ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));
        });

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
            assertIsDefined(anotherItem);
            await saveItemLoginSchema({
              item: anotherItem as unknown as DiscriminatedItem,
              type: ItemLoginSchemaType.UsernameAndPassword,
              password: payload.password,
            });

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login`,
              payload,
            });

            expect(res.json().name).toEqual(payload.username);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });

          it('Successfully reuse item login with username and password', async () => {
            assertIsDefined(anotherItem);
            // pre-create pseudonymized data
            const { guest: m } = await saveItemLoginSchema({
              item: anotherItem as unknown as DiscriminatedItem,
              memberName: payload.username,
              type: ItemLoginSchemaType.UsernameAndPassword,
              password: payload.password,
            });

            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login`,
              payload,
            });

            expectItemLogin(res.json(), m);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });

          it('Throws if item login with username and wrong password', async () => {
            assertIsDefined(anotherItem);
            await saveItemLoginSchema({
              item: anotherItem as unknown as DiscriminatedItem,
              type: ItemLoginSchemaType.UsernameAndPassword,
              password: payload.password,
            });

            // save previous login with some password
            await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login`,
              payload,
            });

            // login again with wrong password - should throw
            const res = await app.inject({
              method: HttpMethod.Post,
              url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login`,
              payload: { username: payload.username, password: 'wrong' },
            });

            expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
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
      const member = await saveMember();
      ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member }));

      const res = await app.inject({
        method: HttpMethod.Put,
        url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema`,
        payload,
      });

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
        ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member: actor }));
        await saveItemLoginSchema({ item: anotherItem as unknown as DiscriminatedItem });
      });

      it('Successfully change type of item login schema', async () => {
        assertIsDefined(anotherItem);
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema`,
          payload,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject(payload);
        const itemLoginSchema = await rawItemLoginSchemaRepository.findOneBy({
          item: { id: anotherItem.id },
        });
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(payload.type);
        expect(itemLoginSchema.status).toEqual(ItemLoginSchemaStatus.Active);
      });

      it('Successfully change type of frozen item login schema', async () => {
        assertIsDefined(actor);
        ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member: actor }));
        await saveItemLoginSchema({
          item: anotherItem as unknown as DiscriminatedItem,
          status: ItemLoginSchemaStatus.Freeze,
        });
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema`,
          payload,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject(payload);
        const itemLoginSchema = await rawItemLoginSchemaRepository.findOneBy({
          item: { id: anotherItem.id },
        });
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(payload.type);
        expect(itemLoginSchema.status).toEqual(ItemLoginSchemaStatus.Freeze);
      });
      it('Successfully change type of disabled item login schema', async () => {
        assertIsDefined(actor);
        ({ item: anotherItem } = await testUtils.saveItemAndMembership({ member: actor }));
        await saveItemLoginSchema({
          item: anotherItem as unknown as DiscriminatedItem,
          status: ItemLoginSchemaStatus.Disabled,
        });
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema`,
          payload,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject(payload);
        const itemLoginSchema = await rawItemLoginSchemaRepository.findOneBy({
          item: { id: anotherItem.id },
        });
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(payload.type);
        expect(itemLoginSchema.status).toEqual(ItemLoginSchemaStatus.Disabled);
      });

      it('Successfully change status of item login schema', async () => {
        const newPayload = {
          status: ItemLoginSchemaStatus.Freeze,
        };
        assertIsDefined(anotherItem);
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema`,
          payload: newPayload,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject(newPayload);
        const itemLoginSchema = await rawItemLoginSchemaRepository.findOneBy({
          item: { id: anotherItem.id },
        });
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(ItemLoginSchemaType.Username);
        expect(itemLoginSchema.status).toEqual(newPayload.status);
      });

      it('Successfully change status and type of item login schema', async () => {
        const newPayload = {
          status: ItemLoginSchemaStatus.Disabled,
          type: ItemLoginSchemaType.UsernameAndPassword,
        };
        assertIsDefined(anotherItem);
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${anotherItem.id}/login-schema`,
          payload: newPayload,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject(newPayload);
        const itemLoginSchema = await rawItemLoginSchemaRepository.findOneBy({
          item: { id: anotherItem.id },
        });
        assertIsDefined(itemLoginSchema);
        expect(itemLoginSchema.type).toEqual(newPayload.type);
        expect(itemLoginSchema.status).toEqual(newPayload.status);
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
        assertIsDefined(anotherItem);
        // save new item with wanted memberships
        const child = await testUtils.saveItem({ parentItem: anotherItem, actor });

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
});
