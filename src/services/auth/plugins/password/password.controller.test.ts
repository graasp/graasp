import { faker } from '@faker-js/faker';
import { compare } from 'bcrypt';
import { compareAsc } from 'date-fns';
import { eq } from 'drizzle-orm';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { Redis } from 'ioredis';
import { sign } from 'jsonwebtoken';
import nock from 'nock';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance, LightMyRequestResponse } from 'fastify';

import { FAILURE_MESSAGES, HttpMethod, RecaptchaAction } from '@graasp/sdk';

import build, {
  MOCK_CAPTCHA,
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { TOKEN_REGEX, mockCaptchaValidationOnce } from '../../../../../test/utils';
import { REDIS_CONNECTION } from '../../../../config/redis';
import { PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES } from '../../../../config/secrets';
import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { accountsTable, memberPasswordsTable } from '../../../../drizzle/schema';
import type { MemberRaw } from '../../../../drizzle/types';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import { assertIsDefined } from '../../../../utils/assertions';
import { assertIsMember, assertIsMemberForTest } from '../../../authentication';

async function login(
  app: FastifyInstance,
  email: string,
  password: string,
): Promise<LightMyRequestResponse> {
  mockCaptchaValidationOnce(RecaptchaAction.SignInWithPassword);
  return app.inject({
    method: 'POST',
    url: '/api/login-password',
    payload: {
      email,
      password,
      captcha: MOCK_CAPTCHA,
    },
  });
}
describe('Password', () => {
  let app: FastifyInstance;
  let mailerService: MailerService;
  let mockSendEmail: jest.SpyInstance;
  let mockRedisSetEx: jest.SpyInstance;

  beforeAll(async () => {
    ({ app } = await build());
    mailerService = resolveDependency(MailerService);
    mockSendEmail = jest
      .spyOn(mailerService, 'sendRaw')
      .mockImplementation(async () => Promise.resolve());
    mockRedisSetEx = jest.spyOn(Redis.prototype, 'setex');
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });
  afterEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line import/no-named-as-default-member
    nock.cleanAll();
    unmockAuthenticate();
  });

  describe('Login with password', () => {
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
        url: '/api/login-password',
        payload: {
          email: actor.email,
          password: pwd,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
      expect(response.headers['set-cookie']).toContain('session=');

      // last authenticated at should be updated
      const m = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.email, actor.email!),
      });
      assertIsDefined(m);
      expect(
        compareAsc(new Date(m.lastAuthenticatedAt!), new Date(actor.lastAuthenticatedAt!)),
      ).toEqual(1);
    });

    it('Sign In successfully with weak password', async () => {
      const pwd = 'weakpassword';

      const { actor } = await seedFromJson({ actor: { password: pwd } });
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/login-password',
        payload: {
          email: actor.email,
          password: pwd,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign In successfully with captcha score = 0', async () => {
      nock('https://www.google.com').get('/recaptcha/api/siteverify').query(true).reply(200, {
        success: true,
        action: RecaptchaAction.SignInWithPassword,
        score: 0,
      });
      const pwd = 'MOCK_PASSWORD';

      const { actor } = await seedFromJson({ actor: { password: pwd } });
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/login-password',
        payload: {
          email: actor.email,
          password: pwd,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign In successfully with captcha score < 0.5', async () => {
      nock('https://www.google.com').get('/recaptcha/api/siteverify').query(true).reply(200, {
        success: true,
        action: RecaptchaAction.SignInWithPassword,
        score: 0.3,
      });
      const pwd = 'MOCK_PASSWORD';

      const { actor } = await seedFromJson({ actor: { password: pwd } });
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/login-password',
        payload: {
          email: actor.email,
          password: pwd,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign In does send unauthorized error for wrong password', async () => {
      const wrongPassword = faker.internet.password({ prefix: '!1Aa' });
      const { actor } = await seedFromJson({ actor: { password: 'somepassword' } });
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/login-password',
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
        url: '/api/login-password',
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
        url: '/api/login-password',
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
        url: '/api/login-password',
        payload: { email, password, captcha: MOCK_CAPTCHA },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('Reset Password', () => {
    beforeEach(() => {
      mockRedisSetEx.mockClear();
    });

    describe('POST Reset Password Request Route', () => {
      it('Create a password request', async () => {
        const { actor: member } = await seedFromJson({
          actor: { password: faker.internet.password({ prefix: '!1Aa' }) },
        });
        assertIsDefined(member);

        mockCaptchaValidationOnce(RecaptchaAction.ResetPassword);
        const response = await app.inject({
          method: 'POST',
          url: '/api/password/reset',
          payload: {
            email: member.email,
            captcha: MOCK_CAPTCHA,
          },
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

        // Wait for the mail to be sent
        await waitForExpect(() => {
          expect(mockSendEmail).toHaveBeenCalledTimes(1);
          expect(mockSendEmail.mock.calls[0][1]).toBe(member.email);
        });
      });

      it('Create a password request to a non-existing email', async () => {
        mockCaptchaValidationOnce(RecaptchaAction.ResetPassword);
        const response = await app.inject({
          method: 'POST',
          url: '/api/password/reset',
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
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockCaptchaValidationOnce(RecaptchaAction.ResetPassword);
        const response = await app.inject({
          method: 'POST',
          url: '/api/password/reset',
          payload: {
            email: actor.email,
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
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockCaptchaValidationOnce(RecaptchaAction.SignIn);
        const response = await app.inject({
          method: 'POST',
          url: '/api/password/reset',
          payload: {
            email: actor.email,
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
      describe('member has previously sent a request', () => {
        let token: string;
        let member: MemberRaw;
        const password = faker.internet.password({ prefix: '!1Aa' });

        beforeEach(async () => {
          const { actor } = await seedFromJson({
            actor: {
              password,
            },
          });
          assertIsDefined(actor);
          assertIsMemberForTest(actor);
          member = actor;
          mockCaptchaValidationOnce(RecaptchaAction.ResetPassword);

          // insert request in caching for patch to work
          const response = await app.inject({
            method: 'POST',
            url: '/api/password/reset',
            payload: {
              email: actor.email,
              captcha: MOCK_CAPTCHA,
            },
          });
          expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

          // Wait for the mail to be sent
          await waitForExpect(() => {
            expect(mockSendEmail).toHaveBeenCalledTimes(1);
            expect(mockSendEmail.mock.calls[0][1]).toBe(actor.email);
          });
          token = mockSendEmail.mock.calls[0][3].match(TOKEN_REGEX)[1];
        });

        it('Reset password', async () => {
          const newPassword = faker.internet.password({ prefix: '!1Aa' });
          const responseReset = await app.inject({
            method: 'PATCH',
            url: '/api/password/reset',
            payload: {
              password: newPassword,
            },
            headers: {
              authorization: `Bearer ${token}`,
            },
          });
          expect(responseReset.statusCode).toBe(StatusCodes.NO_CONTENT);

          // Try to login with the new password
          const responseLogin = await login(app, member.email, newPassword);
          expect(responseLogin.statusCode).toBe(StatusCodes.NO_CONTENT);

          // Try to login with the old password
          const responseLoginOld = await login(app, member.email, password);
          expect(responseLoginOld.statusCode).toBe(StatusCodes.UNAUTHORIZED);

          // Try to login with a wrong password
          const responseLoginWrong = await login(
            app,
            member.email,
            faker.internet.password({ prefix: '!1Aa' }),
          );
          expect(responseLoginWrong.statusCode).toBe(StatusCodes.UNAUTHORIZED);

          // Try to login with a different user
          const anotherPassword = faker.internet.password({ prefix: '!1Aa' });
          const { actor: anotherMember } = await seedFromJson({
            actor: {
              password: anotherPassword,
            },
          });
          assertIsDefined(anotherMember);
          assertIsMemberForTest(anotherMember);
          const responseLoginDifferent = await login(app, anotherMember.email, anotherPassword);
          expect(responseLoginDifferent.statusCode).toBe(StatusCodes.NO_CONTENT);

          // token should be single use
          const responseSecondReset = await app.inject({
            method: 'PATCH',
            url: '/api/password/reset',
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
            url: '/api/password/reset',
            payload: {
              password: newPassword,
            },
            headers: {
              Authorization: `Bearer ${sign({}, 'invalid-token')}`,
            },
          });
          expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);

          // Try to login with the new password
          const responseLogin = await login(app, member.email, newPassword);
          expect(responseLogin.statusCode).toBe(StatusCodes.UNAUTHORIZED);
        });

        it('Reset password without token', async () => {
          const newPassword = faker.internet.password({ prefix: '!1Aa' });
          const response = await app.inject({
            method: 'PATCH',
            url: '/api/password/reset',
            payload: {
              password: newPassword,
            },
          });
          expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

          // Try to login with the new password
          const responseLogin = await login(app, member.email, newPassword);
          expect(responseLogin.statusCode).toBe(StatusCodes.UNAUTHORIZED);
        });
      });

      it('Reset password with an expired token', async () => {
        const { actor: expiredMember } = await seedFromJson({
          actor: {
            password: faker.internet.password({ prefix: '!1Aa' }),
          },
        });
        assertIsDefined(expiredMember);
        assertIsMemberForTest(expiredMember);

        // Overwrite the setex method to test the expiration
        jest.spyOn(Redis.prototype, 'setex').mockImplementationOnce((key, seconds, value) => {
          expect(seconds).toBe(PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES * 60);
          const redis = new Redis(REDIS_CONNECTION);
          return redis.setex(key, 1, value);
        });

        mockCaptchaValidationOnce(RecaptchaAction.ResetPassword);
        const responseCreateReset = await app.inject({
          method: 'POST',
          url: '/api/password/reset',
          payload: {
            email: expiredMember.email,
            captcha: MOCK_CAPTCHA,
          },
        });
        expect(responseCreateReset.statusCode).toBe(StatusCodes.NO_CONTENT);

        // Wait for the mail to be sent
        await waitForExpect(() => {
          expect(mockSendEmail).toHaveBeenCalledTimes(1);
          expect(mockSendEmail.mock.calls[0][1]).toBe(expiredMember.email);
        });
        const expiredToken = mockSendEmail.mock.calls[0][3].match(TOKEN_REGEX)[1];

        // Wait for the token to expire
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const newPassword = faker.internet.password({ prefix: '!1Aa' });
        const responseReset = await app.inject({
          method: 'PATCH',
          url: '/api/password/reset',
          payload: {
            password: newPassword,
          },
          headers: {
            Authorization: `Bearer ${expiredToken}`,
          },
        });
        expect(responseReset.statusCode).toBe(StatusCodes.UNAUTHORIZED);

        // Try to login with the new password
        const responseLogin = await login(app, expiredMember.email, newPassword);
        expect(responseLogin.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });
  });

  describe('Set Password', () => {
    it('Throws when signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/password',
        payload: {
          password: faker.internet.password({ prefix: '!1Aa' }),
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    it('Set new password', async () => {
      const { actor: currentMember } = await seedFromJson();
      assertIsDefined(currentMember);
      assertIsMemberForTest(currentMember);
      const newPassword = faker.internet.password({ prefix: '!1Aa' });
      mockAuthenticate(currentMember);
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/password',
        payload: {
          password: newPassword,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      const savedPasswordEntity = await db.query.memberPasswordsTable.findFirst({
        where: eq(memberPasswordsTable.memberId, currentMember.id),
      });
      assertIsDefined(savedPasswordEntity);
      const areTheSame = await compare(newPassword, savedPasswordEntity.password);
      expect(areTheSame).toBeTruthy();
    });

    it('Fail to set new password when already exists', async () => {
      const { actor: currentMember } = await seedFromJson({
        actor: { password: faker.internet.password({ prefix: '!1Aa' }) },
      });
      assertIsDefined(currentMember);
      assertIsMemberForTest(currentMember);
      const newPassword = faker.internet.password({ prefix: '!1Aa' });
      mockAuthenticate(currentMember);
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/password',
        payload: {
          password: newPassword,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.CONFLICT);
      const savedPasswordEntity = await db.query.memberPasswordsTable.findFirst({
        where: eq(memberPasswordsTable.memberId, currentMember.id),
      });
      assertIsDefined(savedPasswordEntity);
      const areTheSame = await compare(newPassword, savedPasswordEntity.password);
      // the password should not have been changed
      expect(areTheSame).toBeFalsy();
    });

    it('Weak password fails', async () => {
      const { actor: currentMember } = await seedFromJson();
      assertIsDefined(currentMember);
      assertIsMemberForTest(currentMember);
      const newPassword = 'weak';
      mockAuthenticate(currentMember);
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/password',
        payload: {
          password: newPassword,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('Update Password', () => {
    it('Throws when signed out', async () => {
      const newPassword = faker.internet.password({ prefix: '!1Aa' });
      const currentPassword = faker.internet.password({ prefix: '!1Aa' });
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/api/password',
        payload: {
          currentPassword,
          password: newPassword,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    it('Update with new password', async () => {
      const currentPassword = faker.internet.password({ prefix: '!1Aa' });
      const { actor: currentMember } = await seedFromJson({ actor: { password: currentPassword } });
      assertIsDefined(currentMember);
      assertIsMemberForTest(currentMember);
      const newPassword = faker.internet.password({ prefix: '!1Aa' });
      mockAuthenticate(currentMember);
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/api/password',
        payload: {
          currentPassword,
          password: newPassword,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      const savedPasswordEntity = await db.query.memberPasswordsTable.findFirst({
        where: eq(memberPasswordsTable.memberId, currentMember.id),
      });
      assertIsDefined(savedPasswordEntity);
      const areTheSame = await compare(newPassword, savedPasswordEntity.password);
      expect(areTheSame).toBeTruthy();
    });

    it('Fail to update password when current does not match', async () => {
      const currentPassword = faker.internet.password({ prefix: '!1Aa' });
      const { actor: currentMember } = await seedFromJson({
        actor: { password: faker.internet.password({ prefix: '!1Aa' }) },
      });
      assertIsDefined(currentMember);
      assertIsMemberForTest(currentMember);
      const newPassword = faker.internet.password({ prefix: '!1Aa' });
      mockAuthenticate(currentMember);
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/api/password',
        payload: {
          currentPassword,
          password: newPassword,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      const savedPasswordEntity = await db.query.memberPasswordsTable.findFirst({
        where: eq(memberPasswordsTable.memberId, currentMember.id),
      });
      assertIsDefined(savedPasswordEntity);
      const areTheSame = await compare(newPassword, savedPasswordEntity.password);
      // the password should not have been changed
      expect(areTheSame).toBeFalsy();
    });

    it('Fail to update password when current is empty', async () => {
      const { actor: currentMember } = await seedFromJson();
      assertIsDefined(currentMember);
      assertIsMemberForTest(currentMember);
      mockAuthenticate(currentMember);
      const newPassword = faker.internet.password({ prefix: '!1Aa' });
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/api/password',
        payload: {
          currentPassword: '',
          password: newPassword,
        },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Weak password fails', async () => {
      const currentPassword = faker.internet.password({ prefix: '!1Aa' });
      const { actor: currentMember } = await seedFromJson({ actor: { password: currentPassword } });
      assertIsDefined(currentMember);
      assertIsMemberForTest(currentMember);
      mockAuthenticate(currentMember);
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/api/password',
        payload: {
          currentPassword,
          password: 'weak',
        },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('GET members current password status', () => {
    it('Throws when signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/api/members/current/password/status',
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
        url: '/api/members/current/password/status',
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
        url: '/api/members/current/password/status',
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json()).toEqual({ hasPassword: true });
    });
  });

  describe('Flow tests', () => {
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
        url: '/api/login-password',
        payload: { email: actor.email, password: pwd, captcha: MOCK_CAPTCHA },
      });
      expect(loginResponse.statusCode).toEqual(StatusCodes.NO_CONTENT);
      expect(loginResponse.headers['set-cookie']).toContain('session=');
    });
  });
});
