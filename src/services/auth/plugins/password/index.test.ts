import { faker } from '@faker-js/faker';
import { compare } from 'bcrypt';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { Redis } from 'ioredis';
import { sign } from 'jsonwebtoken';
import nock from 'nock';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance, LightMyRequestResponse } from 'fastify';

import { HttpMethod, RecaptchaAction, UUID } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { MemberFactory } from '../../../../../test/factories/member.factory';
import seed, { seedFromJson } from '../../../../../test/mocks/seed';
import { TOKEN_REGEX, mockCaptchaValidationOnce } from '../../../../../test/utils';
import { resolveDependency } from '../../../../di/utils';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import { assertIsDefined } from '../../../../utils/assertions';
import {
  PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES,
  REDIS_HOST,
  REDIS_PASSWORD,
  REDIS_PORT,
  REDIS_USERNAME,
} from '../../../../utils/config';
import { assertIsMember } from '../../../authentication';
import { MOCK_CAPTCHA } from '../captcha/test/utils';
import { encryptPassword } from './utils';

async function login(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<LightMyRequestResponse> {
  mockCaptchaValidationOnce(RecaptchaAction.SignInWithPassword);
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

describe('Login with password', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  beforeEach(() => {
    // mock captcha validation
    mockCaptchaValidationOnce(RecaptchaAction.SignInWithPassword);
  });

  it('Sign In successfully', async () => {
    const pwd = 'myPassword';

    const { actor } = await seedFromJson({ actor: { password: pwd } });
    assertIsDefined(actor);
    assertIsMember(actor);

    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/login-password',
      payload: {
        email: actor.email,
        password: pwd,
        captcha: MOCK_CAPTCHA,
      },
    });
    expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
    expect(response.json()).toHaveProperty('resource');
  });

  it('Sign In successfully with weak password', async () => {
    const pwd = 'weakpassword';

    const { actor } = await seedFromJson({ actor: { password: pwd } });
    assertIsDefined(actor);
    assertIsMember(actor);

    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/login-password',
      payload: {
        email: actor.email,
        password: pwd,
        captcha: MOCK_CAPTCHA,
      },
    });
    expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
    expect(response.json()).toHaveProperty('resource');
  });

  it('Sign In successfully with captcha score = 0', async () => {
    nock('https://www.google.com').get('/recaptcha/api/siteverify').query(true).reply(200, {
      success: true,
      action: RecaptchaAction.SignInWithPassword,
      score: 0,
    });
    const pwd = 'MOCK_PASSWORD';

    const { actor } = await seedFromJson({ actor: { password: await pwd } });
    assertIsDefined(actor);
    assertIsMember(actor);

    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/login-password',
      payload: {
        email: actor.email,
        password: pwd,
        captcha: MOCK_CAPTCHA,
      },
    });
    expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
    expect(response.json()).toHaveProperty('resource');
  });

  it('Sign In successfully with captcha score < 0.5', async () => {
    nock('https://www.google.com').get('/recaptcha/api/siteverify').query(true).reply(200, {
      success: true,
      action: RecaptchaAction.SignInWithPassword,
      score: 0.3,
    });
    const pwd = 'MOCK_PASSWORD';

    const { actor } = await seedFromJson({ actor: { password: await pwd } });
    assertIsDefined(actor);
    assertIsMember(actor);

    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/login-password',
      payload: {
        email: actor.email,
        password: pwd,
        captcha: MOCK_CAPTCHA,
      },
    });
    expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
    expect(response.json()).toHaveProperty('resource');
  });

  it('Sign In does send unauthorized error for wrong password', async () => {
    const wrongPassword = faker.internet.password({ prefix: '!1Aa' });
    const { actor } = await seedFromJson({ actor: { password: 'somepassword' } });
    assertIsDefined(actor);
    assertIsMember(actor);

    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/login-password',
      payload: { email: actor.email, password: wrongPassword, captcha: MOCK_CAPTCHA },
    });
    expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    expect(response.statusMessage).toEqual(ReasonPhrases.UNAUTHORIZED);
  });

  it('Sign In does send not acceptable error when member does not have password', async () => {
    const password = faker.internet.password({ prefix: '!1Aa' });
    const { actor } = await seedFromJson();
    assertIsDefined(actor);
    assertIsMember(actor);

    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/login-password',
      payload: { email: actor.email, password, captcha: MOCK_CAPTCHA },
    });
    expect(response.statusCode).toEqual(StatusCodes.NOT_ACCEPTABLE);
    expect(response.statusMessage).toEqual(ReasonPhrases.NOT_ACCEPTABLE);
  });

  it('Sign In send not found error for non-existing email', async () => {
    const email = 'some@email.com';
    const password = faker.internet.password({ prefix: '!1Aa' });
    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/login-password',
      payload: { email, password, captcha: MOCK_CAPTCHA },
    });

    expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
    expect(response.json().message).toEqual(FAILURE_MESSAGES.MEMBER_NOT_SIGNED_UP);
    expect(response.statusMessage).toEqual(ReasonPhrases.NOT_FOUND);
  });

  it('Bad request for invalid email', async () => {
    const email = 'wrongemail';
    const password = '1234';
    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/login-password',
      payload: { email, password, captcha: MOCK_CAPTCHA },
    });

    expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
    expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
  });
});

describe('Reset Password', () => {
  let app: FastifyInstance;
  let entities: { id: string; email: string; password?: string }[];
  let mailerService: MailerService;
  let mockSendEmail: jest.SpyInstance;
  let mockRedisSetEx: jest.SpyInstance;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
    mailerService = resolveDependency(MailerService);
    mockSendEmail = jest
      .spyOn(mailerService, 'sendRaw')
      .mockImplementation(async () => Promise.resolve());
    mockRedisSetEx = jest.spyOn(Redis.prototype, 'setex');
  });

  afterAll(async () => {
    await clearDatabase(app.db);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // eslint-disable-next-line import/no-named-as-default-member
    nock.cleanAll();

    // Seed the database with members and passwords
    entities = [
      {
        id: faker.string.uuid(),
        password: faker.internet.password({ prefix: '!1Aa' }),
        email: faker.internet.email().toLowerCase(),
      },
      {
        id: faker.string.uuid(),
        password: faker.internet.password({ prefix: '!1Aa' }),
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
        entities: entities.map((e) => ({ id: e.id, email: e.email })),
      },
      passwords: {
        constructor: MemberPassword,
        entities: await Promise.all(
          entities
            .filter((e) => e.password)
            .map(async (e) => ({
              member: e.id,
              password: await encryptPassword(e.password!),
            })),
        ),
      },
    });
  });

  describe('POST Reset Password Request Route', () => {
    it('Create a password request', async () => {
      mockCaptchaValidationOnce(RecaptchaAction.ResetPassword);
      const response = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          email: entities[0].email,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

      // Wait for the mail to be sent
      await waitForExpect(() => {
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
        expect(mockSendEmail.mock.calls[0][1]).toBe(entities[0].email);
      });
    });

    it('Create a password request to a non-existing email', async () => {
      mockCaptchaValidationOnce(RecaptchaAction.ResetPassword);
      const response = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          email: faker.internet.email().toLowerCase(),
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

      // Wait for the mail to be sent
      await waitForExpect(() => {
        expect(mockSendEmail).toHaveBeenCalledTimes(0);
      });
    });
    it('Create a password request to a user without a password', async () => {
      mockCaptchaValidationOnce(RecaptchaAction.ResetPassword);
      const response = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          email: entities[2].email,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

      // Wait for the mail to be sent
      await waitForExpect(() => {
        expect(mockSendEmail).toHaveBeenCalledTimes(0);
      });
    });
    it('Create a password request with an invalid captcha', async () => {
      mockCaptchaValidationOnce(RecaptchaAction.SignIn);
      const response = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          email: entities[0].email,
          captcha: 'bad captcha',
        },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);

      // Wait for the mail to be sent
      await waitForExpect(() => {
        expect(mockSendEmail).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe('PATCH Reset Password Request Route', () => {
    let token: string;

    beforeEach(async () => {
      mockCaptchaValidationOnce(RecaptchaAction.ResetPassword);
      const response = await app.inject({
        method: 'POST',
        url: '/password/reset',
        payload: {
          email: entities[0].email,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

      // Wait for the mail to be sent

      await waitForExpect(() => {
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
        expect(mockSendEmail.mock.calls[0][1]).toBe(entities[0].email);
      });
      token = mockSendEmail.mock.calls[0][3].match(TOKEN_REGEX)[1];
    });

    it('Reset password', async () => {
      const newPassword = faker.internet.password({ prefix: '!1Aa' });
      const responseReset = await app.inject({
        method: 'PATCH',
        url: '/password/reset',
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

      const responseLoginOld = await login(app, entities[0].email, entities[0].password!);
      expect(responseLoginOld.statusCode).toBe(StatusCodes.UNAUTHORIZED);

      // Try to login with a wrong password
      const responseLoginWrong = await login(
        app,
        entities[0].email,
        faker.internet.password({ prefix: '!1Aa' }),
      );
      expect(responseLoginWrong.statusCode).toBe(StatusCodes.UNAUTHORIZED);

      // Try to login with a different user
      const responseLoginDifferent = await login(app, entities[1].email, entities[1].password!);
      expect(responseLoginDifferent.statusCode).toBe(StatusCodes.SEE_OTHER);

      // Set new password to the entities array
      entities[0].password = newPassword;

      // token should be single use
      const responseSecondReset = await app.inject({
        method: 'PATCH',
        url: '/password/reset',
        payload: {
          password: `${newPassword}a`,
        },
        headers: {
          authorization: `Bearer ${token}`,
        },
      });
      expect(responseSecondReset.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('Reset password with an invalid token', async () => {
      const newPassword = faker.internet.password({ prefix: '!1Aa' });
      const response = await app.inject({
        method: 'PATCH',
        url: '/password/reset',
        payload: {
          password: newPassword,
        },
        headers: {
          Authorization: `Bearer ${sign({}, 'invalid-token')}`,
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
        url: '/password/reset',
        payload: {
          password: newPassword,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

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
        port: REDIS_PORT,
        username: REDIS_USERNAME,
        password: REDIS_PASSWORD,
      });
      return redis.setex(key, 1, value);
    });

    mockCaptchaValidationOnce(RecaptchaAction.ResetPassword);
    const responseCreateReset = await app.inject({
      method: 'POST',
      url: '/password/reset',
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
    const token = mockSendEmail.mock.calls[0][3].match(TOKEN_REGEX)[1];

    const newPassword = faker.internet.password({ prefix: '!1Aa' });
    const responseReset = await app.inject({
      method: 'PATCH',
      url: '/password/reset',
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

describe('Set Password', () => {
  let app: FastifyInstance;
  let entities: { id: UUID; password?: string; email: string }[];
  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Seed the database with members and passwords
    entities = [
      {
        id: faker.string.uuid(),
        email: faker.internet.email().toLowerCase(),
      },
      {
        id: faker.string.uuid(),
        password: faker.internet.password({ prefix: '!1Aa' }),
        email: faker.internet.email().toLowerCase(),
      },
    ];
    await seed({
      members: {
        constructor: Member,
        factory: MemberFactory,
        entities: entities.map((e) => ({ id: e.id, email: e.email })),
      },
      passwords: {
        constructor: MemberPassword,
        entities: await Promise.all(
          entities
            .filter((e) => e.password)
            .map(async (e) => ({
              member: e.id,
              password: await encryptPassword(e.password!),
            })),
        ),
      },
    });
  });

  it('Throws when signed out', async () => {
    const newPassword = faker.internet.password({ prefix: '!1Aa' });
    unmockAuthenticate();
    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/password',
      payload: {
        password: newPassword,
      },
    });
    expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
  });

  it('Set new password', async () => {
    const newPassword = faker.internet.password({ prefix: '!1Aa' });
    const currentMember = await Member.findOneByOrFail({ id: entities[0].id });
    mockAuthenticate(currentMember);
    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/password',
      payload: {
        password: newPassword,
      },
    });
    expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
    const savedPasswordEntity = await MemberPassword.findOneByOrFail({
      member: { id: currentMember.id },
    });
    const areTheSame = await compare(newPassword, savedPasswordEntity.password);
    expect(areTheSame).toBeTruthy();
  });

  it('Fail to set new password when already exists', async () => {
    const newPassword = faker.internet.password({ prefix: '!1Aa' });
    const currentMember = await Member.findOneByOrFail({ id: entities[1].id });
    mockAuthenticate(currentMember);
    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/password',
      payload: {
        password: newPassword,
      },
    });
    expect(response.statusCode).toBe(StatusCodes.CONFLICT);
    const savedPasswordEntity = await MemberPassword.findOneByOrFail({
      member: { id: currentMember.id },
    });
    const areTheSame = await compare(newPassword, savedPasswordEntity.password);
    // the password should not have been changed
    expect(areTheSame).toBeFalsy();
  });

  it('Weak password fails', async () => {
    const newPassword = 'weak';
    const currentMember = await Member.findOneByOrFail({ id: entities[0].id });
    mockAuthenticate(currentMember);
    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/password',
      payload: {
        password: newPassword,
      },
    });
    expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
  });
});

describe('Update Password', () => {
  let app: FastifyInstance;
  let entities: { id: UUID; password?: string; email: string }[];
  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
  });

  afterEach(() => {
    unmockAuthenticate();
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Seed the database with members and passwords
    entities = [
      {
        id: faker.string.uuid(),
        password: faker.internet.password({ prefix: '!1Aa' }),
        email: faker.internet.email().toLowerCase(),
      },
      {
        id: faker.string.uuid(),
        password: faker.internet.password({ prefix: '!1Aa' }),
        email: faker.internet.email().toLowerCase(),
      },
    ];
    await seed({
      members: {
        constructor: Member,
        factory: MemberFactory,
        entities: entities.map((e) => ({ id: e.id, email: e.email })),
      },
      passwords: {
        constructor: MemberPassword,
        entities: await Promise.all(
          entities
            .filter((e) => e.password)
            .map(async (e) => ({
              member: e.id,
              password: await encryptPassword(e.password!),
            })),
        ),
      },
    });
  });

  it('Throws when signed out', async () => {
    const newPassword = faker.internet.password({ prefix: '!1Aa' });
    const currentPassword = faker.internet.password({ prefix: '!1Aa' });
    const response = await app.inject({
      method: HttpMethod.Patch,
      url: '/password',
      payload: {
        currentPassword,
        password: newPassword,
      },
    });
    expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
  });

  it('Update with new password', async () => {
    const currentPassword = entities[0].password;
    const newPassword = faker.internet.password({ prefix: '!1Aa' });
    const currentMember = await Member.findOneByOrFail({ id: entities[0].id });
    mockAuthenticate(currentMember);
    const response = await app.inject({
      method: HttpMethod.Patch,
      url: '/password',
      payload: {
        currentPassword,
        password: newPassword,
      },
    });
    expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
    const savedPasswordEntity = await MemberPassword.findOneByOrFail({
      member: { id: currentMember.id },
    });
    const areTheSame = await compare(newPassword, savedPasswordEntity.password);
    expect(areTheSame).toBeTruthy();
  });

  it('Fail to update password when current does not match', async () => {
    const newPassword = faker.internet.password({ prefix: '!1Aa' });
    const currentPassword = faker.internet.password({ prefix: '!1Aa' });
    const currentMember = await Member.findOneByOrFail({ id: entities[1].id });
    mockAuthenticate(currentMember);
    const response = await app.inject({
      method: HttpMethod.Patch,
      url: '/password',
      payload: {
        currentPassword,
        password: newPassword,
      },
    });
    expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    const savedPasswordEntity = await MemberPassword.findOneByOrFail({
      member: { id: currentMember.id },
    });
    const areTheSame = await compare(newPassword, savedPasswordEntity.password);
    // the password should not have been changed
    expect(areTheSame).toBeFalsy();
  });

  it('Fail to update password when current is empty', async () => {
    const newPassword = faker.internet.password({ prefix: '!1Aa' });
    const currentMember = await Member.findOneByOrFail({ id: entities[1].id });
    mockAuthenticate(currentMember);
    const response = await app.inject({
      method: HttpMethod.Patch,
      url: '/password',
      payload: {
        currentPassword: '',
        password: newPassword,
      },
    });
    expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    const savedPasswordEntity = await MemberPassword.findOneByOrFail({
      member: { id: currentMember.id },
    });
    const areTheSame = await compare(newPassword, savedPasswordEntity.password);
    // the password should not have been changed
    expect(areTheSame).toBeFalsy();
  });

  it('Weak password fails', async () => {
    const newPassword = 'weak';
    const currentPassword = entities[0].password;
    const currentMember = await Member.findOneByOrFail({ id: entities[0].id });
    mockAuthenticate(currentMember);
    const response = await app.inject({
      method: HttpMethod.Patch,
      url: '/password',
      payload: {
        currentPassword,
        password: newPassword,
      },
    });
    expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
  });
});

describe('GET members current password status', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterEach(async () => {
    unmockAuthenticate();
  });

  afterAll(async () => {
    app.close();
  });

  it('Throws when signed out', async () => {
    const response = await app.inject({
      method: HttpMethod.Get,
      url: '/members/current/password/status',
    });
    expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
  });

  it('Get password status for member without password', async () => {
    const { actor } = await seedFromJson();
    assertIsDefined(actor);
    assertIsMember(actor);
    mockAuthenticate(actor);

    const response = await app.inject({
      method: HttpMethod.Get,
      url: '/members/current/password/status',
    });
    expect(response.statusCode).toBe(StatusCodes.OK);
    expect(response.json()).toEqual({ hasPassword: false });
  });

  it('Get password status for member with password', async () => {
    const { actor } = await seedFromJson({ actor: { password: 'MOCK_PASSWORD' } });
    assertIsDefined(actor);
    assertIsMember(actor);
    mockAuthenticate(actor);
    const response = await app.inject({
      method: HttpMethod.Get,
      url: '/members/current/password/status',
    });
    expect(response.statusCode).toBe(StatusCodes.OK);
    expect(response.json()).toEqual({ hasPassword: true });
  });
});

describe('Flow tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  it('Sign in with password and use the resource to receive the token', async () => {
    // mock captcha validation
    mockCaptchaValidationOnce(RecaptchaAction.SignInWithPassword);

    const pwd = 'MOCK_PASSWORD';
    const { actor } = await seedFromJson({ actor: { password: pwd } });
    assertIsDefined(actor);
    assertIsMember(actor);
    mockAuthenticate(actor);

    // login
    const loginResponse = await app.inject({
      method: HttpMethod.Post,
      url: '/login-password',
      payload: { email: actor.email, password: pwd, captcha: MOCK_CAPTCHA },
    });

    expect(loginResponse.statusCode).toEqual(StatusCodes.SEE_OTHER);

    const response = await app.inject({
      method: HttpMethod.Get,
      url: loginResponse.json().resource,
    });

    expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
    expect(response.headers['set-cookie']).toContain('session=');
  });
});
