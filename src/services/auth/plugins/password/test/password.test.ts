import { faker } from '@faker-js/faker';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import fetch, { type Response } from 'node-fetch';

import { FastifyInstance } from 'fastify';

import { HttpMethod, MemberFactory, RecaptchaAction, RecaptchaActionType } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

import build, { clearDatabase } from '../../../../../../test/app';
import { saveMember } from '../../../../member/test/fixtures/members';
import { MOCK_CAPTCHA } from '../../captcha/test/utils';
import { MOCK_PASSWORD, saveMemberAndPassword } from './fixtures/password';

jest.mock('node-fetch');

// mock captcha
// bug: cannot use exported mockCaptchaValidation
const mockCaptchaValidation = (action: RecaptchaActionType) => {
  (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
    return { json: async () => ({ success: true, action, score: 1 }) } as Response;
  });
};
// mock database and decorator plugins
// jest.mock('../../../../../plugins/datasource');

describe('Password routes tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    ({ app } = await build({ member: null }));
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);

    app.close();
  });

  describe('POST /login-password', () => {
    beforeEach(() => {
      // mock captcha validation
      mockCaptchaValidation(RecaptchaAction.SignInWithPassword);
    });

    it('Sign In successfully', async () => {
      const m = MemberFactory();
      const pwd = MOCK_PASSWORD;

      const member = await saveMemberAndPassword(m, pwd);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/login-password',
        payload: { email: member.email, password: pwd.password, captcha: MOCK_CAPTCHA },
      });
      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      expect(response.json()).toHaveProperty('resource');
    });

    it('Sign In successfully with captcha score = 0', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
        return {
          json: async () => ({
            success: true,
            action: RecaptchaAction.SignInWithPassword,
            score: 0,
          }),
        } as Response;
      });
      const m = MemberFactory();
      const pwd = MOCK_PASSWORD;

      const member = await saveMemberAndPassword(m, pwd);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/login-password',
        payload: { email: member.email, password: pwd.password, captcha: MOCK_CAPTCHA },
      });
      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      expect(response.json()).toHaveProperty('resource');
    });

    it('Sign In successfully with captcha score < 0.5', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
        return {
          json: async () => ({
            success: true,
            action: RecaptchaAction.SignInWithPassword,
            score: 0.3,
          }),
        } as Response;
      });
      const m = MemberFactory();
      const pwd = MOCK_PASSWORD;

      const member = await saveMemberAndPassword(m, pwd);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/login-password',
        payload: { email: member.email, password: pwd.password, captcha: MOCK_CAPTCHA },
      });
      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      expect(response.json()).toHaveProperty('resource');
    });

    it('Sign In does send unauthorized error for wrong password', async () => {
      const member = MemberFactory();
      const wrongPassword = faker.internet.password({ prefix: '!1Aa' });
      await saveMemberAndPassword(member, MOCK_PASSWORD);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/login-password',
        payload: { email: member.email, password: wrongPassword, captcha: MOCK_CAPTCHA },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      expect(response.statusMessage).toEqual(ReasonPhrases.UNAUTHORIZED);
    });

    it('Sign In does send not acceptable error when member does not have password', async () => {
      const password = faker.internet.password({ prefix: '!1Aa' });
      const member = await saveMember();
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/login-password',
        payload: { email: member.email, password, captcha: MOCK_CAPTCHA },
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
});
