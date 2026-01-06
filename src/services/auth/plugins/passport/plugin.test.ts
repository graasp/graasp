import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import { sign, verify } from 'jsonwebtoken';
import { v4 } from 'uuid';

import type { FastifyInstance, PassportUser } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import {
  APPS_JWT_SECRET,
  EMAIL_CHANGE_JWT_SECRET,
  JWT_SECRET,
  PASSWORD_RESET_JWT_SECRET,
} from '../../../../config/secrets';
import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { ItemRaw, MemberRaw } from '../../../../drizzle/types';
import { assertIsDefined } from '../../../../utils/assertions';
import { BadCredentials } from '../../../../utils/errors';
import { assertIsMember, assertIsMemberForTest } from '../../../authentication';
import { expectItem } from '../../../item/test/fixtures/items';
import { MemberPasswordService } from '../password/password.service';
import {
  authenticateAppsJWT,
  authenticateEmailChange,
  authenticatePassword,
  authenticatePasswordReset,
  guestAuthenticateAppsJWT,
  isAuthenticated,
  optionalIsAuthenticated,
} from './preHandlers';

const MOCKED_ROUTE = '/mock-route';

const expectUserApp = (
  user: PassportUser,
  expected: { item: ItemRaw; key: string; origin: string },
) => {
  expectItem(user.app!.item, expected.item);
  expect(user.app!.key).toEqual(expected.key);
  expect(user.app!.origin).toEqual(expected.origin);
};

/**
 * Send a request to the auth route to log in a member, and return the set-cookie header
 * @param app FastifyInstance
 * @param member Member to log in
 * @returns set-cookie header
 */
async function logIn(app: FastifyInstance, member: { id: string }) {
  const token = sign({ sub: member.id }, JWT_SECRET);
  const response = await app.inject({
    method: HttpMethod.Get,
    path: '/api/auth',
    query: { t: token },
  });
  return response.headers['set-cookie'];
}

const shouldNotBeCalled = () => fail('Should not be called');
const shouldBeNull = ({ user }: { user: unknown }) => expect(user).toBeNull();

describe('Passport Plugin', () => {
  let app: FastifyInstance;
  let handler: jest.Mock;
  let preHandler: jest.Mock;

  beforeAll(async () => {
    ({ app } = await build());

    handler = jest.fn();
    preHandler = jest.fn();
    app.get(MOCKED_ROUTE, { preHandler }, async (...args) => handler(...args));
    app.post(MOCKED_ROUTE, { preHandler }, async (...args) => handler(...args));
  });

  afterAll(async () => {
    app.close();
  });

  afterEach(async () => {
    handler.mockClear();
  });

  describe('Optional Authenticated', () => {
    beforeEach(async () => {
      preHandler.mockImplementation(optionalIsAuthenticated);
    });
    it('Unauthenticated', async () => {
      handler.mockImplementation(shouldBeNull);
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    // it('Unknown JWT Member', async () => {
    //   const token = sign({ sub: v4() }, AUTH_TOKEN_JWT_SECRET);
    //   handler.mockImplementation(shouldBeNull);
    //   const response = await app.inject({
    //     path: MOCKED_ROUTE,
    //     headers: { authorization: `Bearer ${token}` },
    //   });
    //   expect(handler).toHaveBeenCalledTimes(0);
    //   expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    // });
    it('Invalid JWT Member', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      const token = sign({ sub: actor.id }, 'invalid');
      handler.mockImplementation(shouldBeNull);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    // it('Valid JWT Member', async () => {
    //   const { actor } = await seedFromJson();
    //   assertIsDefined(actor);
    //   assertIsMemberForTest(actor);
    //   const token = sign({ sub: actor.id }, AUTH_TOKEN_JWT_SECRET);
    //   handler.mockImplementation(({ user }) => {
    //     expect(user.account.id).toEqual(actor.id);
    //   });
    //   const response = await app.inject({
    //     path: MOCKED_ROUTE,
    //     headers: { authorization: `Bearer ${token}` },
    //   });
    //   expect(handler).toHaveBeenCalledTimes(1);
    //   expect(response.statusCode).toBe(StatusCodes.OK);
    // });
    it('Invalid Session Member', async () => {
      const cookie = 'session=abc; Domain=localhost; Path=/; HttpOnly';
      handler.mockImplementation(shouldBeNull);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { cookie },
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    it('Valid Session Member', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      const cookie = await logIn(app, actor);
      handler.mockImplementation(async ({ user }) => {
        expect(actor.id).toEqual(user.account.id);
      });
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { cookie },
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
  });

  describe('Authenticated', () => {
    beforeEach(async () => {
      preHandler.mockImplementation(isAuthenticated);
    });
    it('Unauthenticated', async () => {
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    // it('Unknown JWT Member', async () => {
    //   const token = sign({ sub: v4() }, AUTH_TOKEN_JWT_SECRET);
    //   handler.mockImplementation(shouldNotBeCalled);
    //   const response = await app.inject({
    //     path: MOCKED_ROUTE,
    //     headers: { authorization: `Bearer ${token}` },
    //   });
    //   expect(handler).toHaveBeenCalledTimes(0);
    //   expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    // });
    it('Invalid JWT Member', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      const token = sign({ sub: actor.id }, 'invalid');
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    // it('Valid JWT Member', async () => {
    //   const { actor } = await seedFromJson();
    //   assertIsDefined(actor);
    //   assertIsMemberForTest(actor);
    //   const token = sign({ sub: actor.id }, AUTH_TOKEN_JWT_SECRET);
    //   handler.mockImplementation(({ user }) => expect(user.account.id).toEqual(actor.id));
    //   const response = await app.inject({
    //     path: MOCKED_ROUTE,
    //     headers: { authorization: `Bearer ${token}` },
    //   });
    //   expect(handler).toHaveBeenCalledTimes(1);
    //   expect(response.statusCode).toBe(StatusCodes.OK);
    // });
    it('Invalid Session Member', async () => {
      const cookie = 'session=abc; Domain=localhost; Path=/; HttpOnly';
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { cookie },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Valid Session Member', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      const cookie = await logIn(app, actor);
      handler.mockImplementation(async ({ user }) => {
        expect(actor.id).toEqual(user.account.id);
      });
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { cookie },
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
  });

  describe('authenticatePassword', () => {
    let password: string;
    let newMember: MemberRaw;
    beforeEach(async () => {
      preHandler.mockImplementation(authenticatePassword);
      password = faker.internet.password({ prefix: '!1Aa' });
      const { actor } = await seedFromJson({
        actor: {
          password,
        },
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      newMember = actor;
    });
    it('No parameters', async () => {
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        method: HttpMethod.Post,
        path: MOCKED_ROUTE,
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('No password', async () => {
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        method: HttpMethod.Post,
        path: MOCKED_ROUTE,
        payload: {
          email: newMember.email,
        },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('No email', async () => {
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        method: HttpMethod.Post,
        path: MOCKED_ROUTE,
        payload: {
          password,
        },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('Bad password', async () => {
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        method: HttpMethod.Post,
        path: MOCKED_ROUTE,
        payload: {
          email: newMember.email,
          password: faker.internet.password({ prefix: '!1Aa' }),
        },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(response.json().name).toEqual(new BadCredentials().name);
    });
    it('Unknown email', async () => {
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        method: HttpMethod.Post,
        path: MOCKED_ROUTE,
        payload: {
          email: faker.internet.email(),
          password,
        },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('Another email', async () => {
      const {
        members: [member],
      } = await seedFromJson({
        members: [{}],
      });
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        method: HttpMethod.Post,
        path: MOCKED_ROUTE,
        payload: {
          email: member.email,
          password,
        },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.NOT_ACCEPTABLE);
    });
    it('Authenticated', async () => {
      handler.mockImplementation(({ user }) => expect(user.account.id).toEqual(newMember.id));
      const response = await app.inject({
        method: HttpMethod.Post,
        path: MOCKED_ROUTE,
        payload: {
          email: newMember.email,
          password: password,
        },
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
  });
  // describe('authenticateMobileMagicLink', () => {
  //   beforeEach(async () => {
  //     preHandler.mockImplementation(authenticateMobileMagicLink);
  //   });
  //   it('Unauthenticated', async () => {
  //     handler.mockImplementation(shouldNotBeCalled);
  //     const response = await app.inject({ path: MOCKED_ROUTE });
  //     expect(handler).toHaveBeenCalledTimes(0);
  //     expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  //   });
  //   it('Unknown JWT Member', async () => {
  //     const token = sign({ sub: v4() }, AUTH_TOKEN_JWT_SECRET);
  //     handler.mockImplementation(shouldNotBeCalled);
  //     const response = await app.inject({
  //       path: MOCKED_ROUTE,
  //       query: { token },
  //     });
  //     expect(handler).toHaveBeenCalledTimes(0);
  //     expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
  //   });
  //   it('Invalid JWT Member', async () => {
  //     const token = sign({ sub: v4() }, 'invalid');
  //     handler.mockImplementation(shouldNotBeCalled);
  //     const response = await app.inject({
  //       path: MOCKED_ROUTE,
  //       query: { token },
  //     });
  //     expect(handler).toHaveBeenCalledTimes(0);
  //     expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  //   });
  //   it('Valid JWT Member', async () => {
  //     const { actor } = await seedFromJson();
  //     assertIsDefined(actor);
  //     assertIsMemberForTest(actor);
  //     const token = sign({ sub: actor.id }, AUTH_TOKEN_JWT_SECRET);
  //     handler.mockImplementation(({ user }) => expect(user.account.id).toEqual(actor.id));
  //     const response = await app.inject({
  //       path: MOCKED_ROUTE,
  //       query: { token },
  //     });
  //     expect(handler).toHaveBeenCalledTimes(1);
  //     expect(response.statusCode).toBe(StatusCodes.OK);
  //   });
  // });
  describe('authenticatePasswordReset', () => {
    let token: string;
    let uuid: string;
    let newMember: MemberRaw;
    let password: string;
    beforeEach(async () => {
      preHandler.mockImplementation(authenticatePasswordReset);
      password = faker.internet.password({ prefix: '!1Aa' });
      const { actor } = await seedFromJson({
        actor: { password },
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      newMember = actor;
      const memberPasswordService = resolveDependency(MemberPasswordService);
      const result = await memberPasswordService.createResetPasswordRequest(db, newMember.email);
      expect(result?.token).toBeDefined();
      token = result!.token;
      uuid = (verify(token, PASSWORD_RESET_JWT_SECRET) as { uuid: string }).uuid;
    });
    it('Unauthenticated', async () => {
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Unknown JWT uuid', async () => {
      const token = sign({ uuid: v4() }, PASSWORD_RESET_JWT_SECRET);
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Invalid JWT', async () => {
      const token = sign({ uuid }, 'invalid');
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Valid JWT Member', async () => {
      handler.mockImplementation(({ user }) => expect(user.passwordResetRedisKey).toEqual(uuid));
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
  });
  describe('authenticateEmailChange', () => {
    let newEmail: string;
    beforeEach(async () => {
      preHandler.mockImplementation(authenticateEmailChange);
      newEmail = faker.internet.email().toLowerCase();
    });
    it('Unauthenticated', async () => {
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Unknown JWT uuid', async () => {
      const token = sign({ uuid: v4(), oldEmail: 'abc', newEmail: 'def' }, EMAIL_CHANGE_JWT_SECRET);
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Bad old email', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      const token = sign({ uuid: actor.id, oldEmail: 'abc', newEmail }, EMAIL_CHANGE_JWT_SECRET);
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Invalid JWT', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      const token = sign({ uuid: actor.id, oldEmail: actor.email, newEmail }, 'invalid');
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Valid JWT Member', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      const token = sign(
        { uuid: actor.id, oldEmail: actor.email, newEmail },
        EMAIL_CHANGE_JWT_SECRET,
      );
      handler.mockImplementation(({ user }: { user: PassportUser }) => {
        assertIsDefined(user.account);
        expect(user.account.id).toEqual(actor.id);
        expect(user.emailChange?.newEmail).toEqual(newEmail);
      });
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
  });
  describe('authenticateAppsJWT', () => {
    const key = 'key';
    const origin = 'origin';
    beforeEach(async () => {
      preHandler.mockImplementation(authenticateAppsJWT);
    });
    it('Unauthenticated', async () => {
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Unknown JWT Member', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });
      const token = sign(
        { sub: { accountId: v4(), itemId: item.id, key, origin } },
        APPS_JWT_SECRET,
      );
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Unspecified JWT Member', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });
      const token = sign({ sub: { itemId: item.id, key, origin } }, APPS_JWT_SECRET);
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Unknown JWT Item', async () => {
      const { actor } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      const token = sign(
        { sub: { accountId: actor.id, itemId: v4(), key, origin } },
        APPS_JWT_SECRET,
      );
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Unspecified JWT Item', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      const token = sign({ sub: { accountId: actor.id, key, origin } }, APPS_JWT_SECRET);
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Invalid JWT', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      const token = sign({ sub: { accountId: actor.id, itemId: item.id, key, origin } }, 'invalid');
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Unspecified key', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      const token = sign(
        { sub: { accountId: actor.id, itemId: item.id, origin } },
        APPS_JWT_SECRET,
      );
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Unspecified origin', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      const token = sign({ sub: { accountId: actor.id, itemId: item.id, key } }, APPS_JWT_SECRET);
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Valid JWT', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      const token = sign(
        { sub: { accountId: actor.id, itemId: item.id, key, origin } },
        APPS_JWT_SECRET,
      );
      handler.mockImplementation(({ user }) => {
        expectUserApp(user, { item, key, origin });
        expect(user.account.id).toEqual(actor.id);
      });
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
  });
  describe('guestAuthenticateAppsJWT', () => {
    const key = 'key';
    const origin = 'origin';
    beforeEach(async () => {
      preHandler.mockImplementation(guestAuthenticateAppsJWT);
    });
    it('Unauthenticated', async () => {
      handler.mockImplementation(shouldBeNull);
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Unknown JWT Member', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });
      const token = sign(
        { sub: { accountId: v4(), itemId: item.id, key, origin } },
        APPS_JWT_SECRET,
      );
      handler.mockImplementation(({ user }) => {
        expectUserApp(user, { item, key, origin });
        expect(user.account).toBeUndefined();
      });
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    it('Unspecified JWT Member', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{}] });
      const token = sign({ sub: { itemId: item.id, key, origin } }, APPS_JWT_SECRET);
      handler.mockImplementation(({ user }) => {
        expectUserApp(user, { item, key, origin });
        expect(user.account).toBeUndefined();
      });
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    it('Unknown JWT Item', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      const token = sign(
        { sub: { accountId: actor.id, itemId: v4(), key, origin } },
        APPS_JWT_SECRET,
      );
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Unspecified JWT Item', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      const token = sign({ sub: { accountId: actor.id, key, origin } }, APPS_JWT_SECRET);
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Invalid JWT', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      const token = sign({ sub: { accountId: actor.id, itemId: item.id, key, origin } }, 'invalid');
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Unspecified key', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      const token = sign(
        { sub: { accountId: actor.id, itemId: item.id, origin } },
        APPS_JWT_SECRET,
      );
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Unspecified origin', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      const token = sign({ sub: { accountId: actor.id, itemId: item.id, key } }, APPS_JWT_SECRET);
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Valid JWT', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      const token = sign(
        { sub: { accountId: actor.id, itemId: item.id, key, origin } },
        APPS_JWT_SECRET,
      );
      handler.mockImplementation(({ user }) => {
        expectUserApp(user, { item, key, origin });
        expect(user.account.id).toEqual(actor.id);
      });
      const response = await app.inject({
        path: MOCKED_ROUTE,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
  });
});
