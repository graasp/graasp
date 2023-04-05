import { StatusCodes } from 'http-status-codes';

import { HttpMethod, ItemLoginSchemaType, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../../util/config';
import { MemberCannotAdminItem } from '../../../util/graasp-error';
import { Item } from '../../item/entities/Item';
import { Member } from '../../member/entities/member';
import { ItemLogin } from '../entities/itemLogin';
import { ItemLoginSchema,  } from '../entities/itemLoginSchema';
import ItemLoginRepository from '../repositories/itemLogin';
import { encryptPassword, generateRandomEmail } from '../util/aux';
import { ValidMemberSession } from '../util/graasp-item-login-error';
import { USERNAME_LOGIN } from './fixtures';
import { BOB, expectMember, saveMember } from '../../member/test/fixtures/members';
import { saveItemAndMembership, saveMembership } from '../../itemMembership/test/fixtures/memberships';
import { getDummyItem, saveItem } from '../../item/test/fixtures/items';

// mock datasource
jest.mock('../../../plugins/datasource');

const saveItemLogin = async ({
  item,
  password,
  type = ItemLoginSchemaType.USERNAME,
  member,
}: {
  item: Item;
  type?: ItemLoginSchemaType;
  password?: string;
  member?: Member;
}) => {
  const itemLoginSchema = await ItemLoginSchema.save({ item, type });
  const values: { itemLoginSchema: ItemLoginSchema; itemLogin?: ItemLogin } = { itemLoginSchema };
  if (member) {
    const hashedPassword = password && (await encryptPassword(password));
    values.itemLogin = await ItemLogin.save({ itemLoginSchema, password: hashedPassword, member });
  }
  return values;
};

const savePseudonymizedMember = (name) => {
  return saveMember({
    name,
    email: generateRandomEmail(),
  });
};

describe('Item Login Tests', () => {
  let app;
  let actor;
  let item;
  let member;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    item = null;
    member = null;
    app.close();
  });

  describe('GET /:id/login-schema', () => {
    it('Get item login if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      ({ item } = await saveItemAndMembership({ member }));
      const { itemLoginSchema } = await saveItemLogin({ item });

      const res = await app.inject({
        method: HttpMethod.GET,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
      });

      expect(res.statusCode).toBe(StatusCodes.OK);
      expect(res.body).toEqual(itemLoginSchema.type);
    });

    describe('Signed In', () => {
      let itemLoginSchema;

      beforeEach(async () => {
        ({ app, actor } = await build());
        const member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));
        ({ itemLoginSchema } = await saveItemLogin({ item }));
      });

      it('Successfully get item login', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.body).toEqual(itemLoginSchema.type);
      });

      it('Throws if id is not valid', async () => {
        const id = 'invalid-id';

        const res = await app.inject({
          method: HttpMethod.GET,
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
        const member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));
        await saveItemLogin({ item });
      });

      it('Cannot item login if already signed in', async () => {
        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
          payload: { username: 'my-username' },
        });
        expect(res.json()).toMatchObject(new ValidMemberSession(expect.anything()));
      });
    });

    describe(ItemLoginSchemaType.USERNAME, () => {
      describe('Signed Out', () => {
        beforeEach(async () => {
          ({ app } = await build({ member: null }));
          member = await saveMember(BOB);
          ({ item } = await saveItemAndMembership({ member }));
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
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/${id}/login`,
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        describe('Username', () => {
          it('Successfully create item login with username', async () => {
            const payload = USERNAME_LOGIN;
            await saveItemLogin({ item });
            expect(await ItemLoginRepository.find()).toHaveLength(0);

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expect(res.json().name).toEqual(payload.username);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });

          it('Successfully reuse item login with username', async () => {
            const payload = USERNAME_LOGIN;
            // pre-create pseudonymized data
            const m = await savePseudonymizedMember(payload.username);
            await saveItemLogin({ item, member: m });

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expectMember(res.json(), m);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });
        });

        describe('Member Id', () => {
          it('Successfully create item login with member id', async () => {
            await saveItemLogin({ item });
            const pseudonymizedMember = await savePseudonymizedMember('pseudonymized');
            expect(await ItemLoginRepository.find()).toHaveLength(0);

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload: { memberId: pseudonymizedMember.id },
            });

            expect(res.statusCode).toBe(StatusCodes.OK);
            expectMember(res.json(), pseudonymizedMember);
          });

          it('Successfully reuse item login with member id', async () => {
            // pre-create pseudonymized data
            const m = await savePseudonymizedMember('pseudonymized');
            const payload = { memberId: m.id };
            await saveItemLogin({ item, member: m });
            expect(await ItemLoginRepository.find()).toHaveLength(1);

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expect(res.statusCode).toBe(StatusCodes.OK);
            expectMember(res.json(), m);
            expect(await ItemLoginRepository.find()).toHaveLength(1);
          });

          it('Successfully reuse user to create new item login', async () => {
            // pre-create pseudonymized data
            const m = await savePseudonymizedMember('pseudonymized');

            const payload = { memberId: m.id };
            await saveItemLogin({ item, member: m });
            expect(await ItemLoginRepository.find()).toHaveLength(1);

            // set up second item
            const newItem = await saveItem({ item: getDummyItem(), actor: member });
            await saveItemLogin({ item: newItem });

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${newItem.id}/login`,
              payload,
            });

            expect(res.statusCode).toBe(StatusCodes.OK);
            expectMember(res.json(), m);
            expect(await ItemLoginRepository.find()).toHaveLength(2);
          });

          it('Throws if member id is invalid', async () => {
            const payload = { memberId: 'memberId' };

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
          });
        });
      });
    });

    describe(ItemLoginSchemaType.USERNAME_AND_PASSWORD, () => {
      const payload = { ...USERNAME_LOGIN, password: 'password' };

      describe('Signed Out', () => {
        beforeEach(async () => {
          ({ app } = await build({ member: null }));
          member = await saveMember(BOB);
          ({ item } = await saveItemAndMembership({ member }));
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
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/${id}/login`,
          });

          expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        });

        describe('Username', () => {
          it('Successfully create item login with username and password', async () => {
            await saveItemLogin({
              item,
              type: ItemLoginSchemaType.USERNAME_AND_PASSWORD,
              password: payload.password,
            });
            expect(await ItemLoginRepository.find()).toHaveLength(0);

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expect(res.json().name).toEqual(payload.username);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });

          it('Successfully reuse item login with username and password', async () => {
            // pre-create pseudonymized data
            const m = await savePseudonymizedMember(payload.username);
            await saveItemLogin({
              item,
              member: m,
              type: ItemLoginSchemaType.USERNAME_AND_PASSWORD,
              password: payload.password,
            });

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expectMember(res.json(), m);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });

          it('Throws if item login with username and wrong password', async () => {
            await saveItemLogin({
              item,
              type: ItemLoginSchemaType.USERNAME_AND_PASSWORD,
              password: payload.password,
            });
            expect(await ItemLoginRepository.find()).toHaveLength(0);

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expect(res.json().name).toEqual(payload.username);
            expect(res.statusCode).toBe(StatusCodes.OK);
          });
        });

        describe('Member Id', () => {
          it('Successfully create item login with member id and password', async () => {
            await saveItemLogin({ item, type: ItemLoginSchemaType.USERNAME_AND_PASSWORD });
            const pseudonymizedMember = await savePseudonymizedMember('pseudonymized');
            expect(await ItemLoginRepository.find()).toHaveLength(0);

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload: { memberId: pseudonymizedMember.id },
            });

            expect(res.statusCode).toBe(StatusCodes.OK);
            expectMember(res.json(), pseudonymizedMember);
          });

          it('Successfully reuse item login with member id and password', async () => {
            // pre-create pseudonymized data
            const m = await savePseudonymizedMember('pseudonymized');
            const payload = { memberId: m.id, password: 'my-password' };
            await saveItemLogin({
              item,
              member: m,
              type: ItemLoginSchemaType.USERNAME_AND_PASSWORD,
              password: payload.password,
            });
            expect(await ItemLoginRepository.find()).toHaveLength(1);

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expect(res.statusCode).toBe(StatusCodes.OK);
            expectMember(res.json(), m);
            expect(await ItemLoginRepository.find()).toHaveLength(1);
          });

          it('Fail to item login with member id if password is wrong', async () => {
            // pre-create pseudonymized data
            const m = await savePseudonymizedMember('pseudonymized');
            const payload = { memberId: m.id, password: 'my-password' };
            await saveItemLogin({
              item,
              member: m,
              type: ItemLoginSchemaType.USERNAME_AND_PASSWORD,
              password: payload.password,
            });
            expect(await ItemLoginRepository.find()).toHaveLength(1);

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expect(res.statusCode).toBe(StatusCodes.OK);
            expectMember(res.json(), m);
            expect(await ItemLoginRepository.find()).toHaveLength(1);
          });

          it('Successfully reuse user to create new item login', async () => {
            // pre-create pseudonymized data
            const m = await savePseudonymizedMember('pseudonymized');

            const payload = { memberId: m.id };
            await saveItemLogin({ item, member: m, type: ItemLoginSchemaType.USERNAME_AND_PASSWORD });
            expect(await ItemLoginRepository.find()).toHaveLength(1);

            // set up second item
            const newItem = await saveItem({ item: getDummyItem(), actor: member });
            await saveItemLogin({ item: newItem, type: ItemLoginSchemaType.USERNAME_AND_PASSWORD });

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${newItem.id}/login`,
              payload,
            });

            expect(res.statusCode).toBe(StatusCodes.OK);
            expectMember(res.json(), m);
            expect(await ItemLoginRepository.find()).toHaveLength(2);
          });

          it('Throws if member id is invalid', async () => {
            const payload = { memberId: 'memberId' };

            const res = await app.inject({
              method: HttpMethod.POST,
              url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login`,
              payload,
            });

            expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
          });
        });
      });
    });
  });

  describe('PUT /:id/login-schema', () => {
    const payload = {
      type: ItemLoginSchemaType.USERNAME_AND_PASSWORD,
    };

    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      ({ item } = await saveItemAndMembership({ member }));

      const res = await app.inject({
        method: HttpMethod.PUT,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
        payload,
      });

      expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await saveItemAndMembership({ member: actor }));
        await saveItemLogin({ item });
      });

      it('Successfully change item login schema', async () => {
        const res = await app.inject({
          method: HttpMethod.PUT,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/login-schema`,
          payload,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject(payload);
      });

      it('Cannot change item login schema if have write permission', async () => {
        // save new item with wanted memberships
        const member = await saveMember(BOB);
        const { item: item1 } = await saveItemAndMembership({ member });
        await saveMembership({ item: item1, member: actor, permission: PermissionLevel.Write });

        await saveItemLogin({ item });

        const res = await app.inject({
          method: HttpMethod.PUT,
          url: `${ITEMS_ROUTE_PREFIX}/${item1.id}/login-schema`,
          payload,
        });

        expect(res.json()).toMatchObject(new MemberCannotAdminItem(expect.anything()));
      });

      it('Throws if id is invalid', async () => {
        const id = 'valid-id';
        const payload = {
          loginSchema: ItemLoginSchemaType.USERNAME_AND_PASSWORD,
        };

        const res = await app.inject({
          method: HttpMethod.PUT,
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
          method: HttpMethod.PUT,
          url: `${ITEMS_ROUTE_PREFIX}/${id}/login-schema`,
          payload,
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
