import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

import { FastifyInstance, LightMyRequestResponse } from 'fastify';

import { MemberFactory, RecaptchaAction } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import seed from '../../../../../test/mock';
import { mockCaptchaValidation } from '../../../../../test/utils';
import {
  PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
} from '../../../../utils/config';
import { Member } from '../../../member/entities/member';
import { MOCK_CAPTCHA } from '../captcha/test/utils';
import { MemberPassword } from './entities/password';
import { encryptPassword } from './utils';

jest.mock('node-fetch');
jest.mock('../../../../plugins/datasource');

async function login(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<LightMyRequestResponse> {
  mockCaptchaValidation(RecaptchaAction.SignInWithPassword);
  return app.inject({
    method: 'POST',
    url: '/login-password',
    payload: {
      email,
      password,
      captcha: MOCK_CAPTCHA,
    },
  });
}

describe('Reset Password', () => {
  let app: FastifyInstance;
  let entities;
  let mockSendEmail;
  let mockRedisSetEx;
  beforeAll(async () => {
    ({ app } = await build());
    mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
    mockRedisSetEx = jest.spyOn(Redis.prototype, 'setex');

    // Seed the database with members and passwords
    entities = [
      {
        id: faker.string.uuid(),
        pass: faker.internet.password({ prefix: '!1Aa' }),
        email: faker.internet.email().toLowerCase(),
      },
      {
        id: faker.string.uuid(),
        pass: faker.internet.password({ prefix: '!1Aa' }),
        email: faker.internet.email().toLowerCase(),
      },
      {
        id: faker.string.uuid(),
        email: faker.internet.email().toLowerCase(),
      },
    ];
    await seed({
      members: {
        constructor: Member,
        factory: MemberFactory,
        entities: [
          { id: entities[0].id, email: entities[0].email },
          { id: entities[1].id, email: entities[1].email },
          { id: entities[2].id, email: entities[2].email },
        ],
      },
      passwords: {
        constructor: MemberPassword,
        entities: [
          { member: entities[0].id, password: await encryptPassword(entities[0].pass) },
          { member: entities[1].id, password: await encryptPassword(entities[1].pass) },
        ],
      },
    });
  });

  afterAll(async () => {
    await clearDatabase(app.db);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  describe('POST Reset Password Request Route', () => {
    it('Create a password request', async () => {
      mockCaptchaValidation(RecaptchaAction.ResetPassword);
      const response = await app.inject({
        method: 'POST',
        url: '/reset-password-request',
        payload: {
          email: entities[0].email,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

      // Wait for the mail to be sent
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][1]).toBe(entities[0].email);
    });
    it('Create a password request to an non-existing email', async () => {
      mockCaptchaValidation(RecaptchaAction.ResetPassword);
      const response = await app.inject({
        method: 'POST',
        url: '/reset-password-request',
        payload: {
          email: faker.internet.email().toLowerCase(),
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

      // Wait for the mail to be sent
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });
    it('Create a password request to a user without a password', async () => {
      mockCaptchaValidation(RecaptchaAction.ResetPassword);
      const response = await app.inject({
        method: 'POST',
        url: '/reset-password-request',
        payload: {
          email: entities[2].email,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

      // Wait for the mail to be sent
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });
    it('Create a password request with an invalid captcha', async () => {
      mockCaptchaValidation(RecaptchaAction.SignIn);
      const response = await app.inject({
        method: 'POST',
        url: '/reset-password-request',
        payload: {
          email: entities[0].email,
          captcha: 'bad captcha',
        },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);

      // Wait for the mail to be sent
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSendEmail).toHaveBeenCalledTimes(0);
    });
  });

  describe('PATCH Reset Password Request Route', () => {
    let token: string;
    beforeEach(async () => {
      mockCaptchaValidation(RecaptchaAction.ResetPassword);
      const response = await app.inject({
        method: 'POST',
        url: '/reset-password-request',
        payload: {
          email: entities[0].email,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

      // Wait for the mail to be sent
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][1]).toBe(entities[0].email);
      token = mockSendEmail.mock.calls[0][2].split('?t=')[1];
    });
    it('Reset password', async () => {
      const newPassword = faker.internet.password({ prefix: '!1Aa' });
      const responseReset = await app.inject({
        method: 'PATCH',
        url: '/reset-password-request',
        payload: {
          password: newPassword,
        },
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      expect(responseReset.statusCode).toBe(StatusCodes.NO_CONTENT);

      // Try to login with the new password
      const responseLogin = await login(app, entities[0].email, newPassword);
      expect(responseLogin.statusCode).toBe(StatusCodes.SEE_OTHER);

      // Try to login with the old password

      const responseLoginOld = await login(app, entities[0].email, entities[0].pass);
      expect(responseLoginOld.statusCode).toBe(StatusCodes.UNAUTHORIZED);

      // Try to login with a wrong password
      const responseLoginWrong = await login(
        app,
        entities[0].email,
        faker.internet.password({ prefix: '!1Aa' }),
      );
      expect(responseLoginWrong.statusCode).toBe(StatusCodes.UNAUTHORIZED);

      // Try to login with a different user
      const responseLoginDifferent = await login(app, entities[1].email, entities[1].pass);
      expect(responseLoginDifferent.statusCode).toBe(StatusCodes.SEE_OTHER);

      // Set new password to the entities array
      entities[0].pass = newPassword;
    });
    it('Reset password with an invalid token', async () => {
      const newPassword = faker.internet.password({ prefix: '!1Aa' });
      const response = await app.inject({
        method: 'PATCH',
        url: '/reset-password-request',
        payload: {
          password: newPassword,
        },
        headers: {
          Authorization: `Bearer ${jwt.sign({}, 'invalid-token')}`,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);

      // Try to login with the new password
      const responseLogin = await login(app, entities[0].email, newPassword);
      expect(responseLogin.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('Reset password without token', async () => {
      const newPassword = faker.internet.password({ prefix: '!1Aa' });
      const response = await app.inject({
        method: 'PATCH',
        url: '/reset-password-request',
        payload: {
          password: newPassword,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);

      // Try to login with the new password
      const responseLogin = await login(app, entities[0].email, newPassword);
      expect(responseLogin.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  it('Reset password with an expired token', async () => {
    // Overwrite the setex method to test the expiration
    mockRedisSetEx.mockImplementationOnce((key, seconds, value) => {
      expect(seconds).toBe(PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES * 60);
      const redis = new Redis({
        host: REDIS_HOST,
        port: parseInt(REDIS_PORT ?? '6379'),
        username: REDIS_USERNAME,
        password: REDIS_PASSWORD,
      });
      return redis.setex(key, 1, value);
    });

    mockCaptchaValidation(RecaptchaAction.ResetPassword);
    const responseCreateReset = await app.inject({
      method: 'POST',
      url: '/reset-password-request',
      payload: {
        email: entities[0].email,
        captcha: MOCK_CAPTCHA,
      },
    });
    expect(responseCreateReset.statusCode).toBe(StatusCodes.NO_CONTENT);

    // Wait for the token to expire
    await new Promise((resolve) => setTimeout(resolve, 2000));

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][1]).toBe(entities[0].email);
    const token = mockSendEmail.mock.calls[0][2].split('?t=')[1];

    const newPassword = faker.internet.password({ prefix: '!1Aa' });
    const responseReset = await app.inject({
      method: 'PATCH',
      url: '/reset-password-request',
      payload: {
        password: newPassword,
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    expect(responseReset.statusCode).toBe(StatusCodes.UNAUTHORIZED);

    // Try to login with the new password
    const responseLogin = await login(app, entities[0].email, newPassword);
    expect(responseLogin.statusCode).toBe(StatusCodes.UNAUTHORIZED);
  });
});
