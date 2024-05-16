import crypto from 'crypto';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import fetch, { type Response } from 'node-fetch';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, MemberFactory, RecaptchaAction, RecaptchaActionType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import {
  AUTH_TOKEN_JWT_SECRET,
  JWT_SECRET,
  MOBILE_DEEP_LINK_PROTOCOL,
  REFRESH_TOKEN_JWT_SECRET,
} from '../../../../utils/config';
import { MemberNotFound } from '../../../../utils/errors';
import MemberRepository from '../../../member/repository';
import { expectMember, saveMember } from '../../../member/test/fixtures/members';
import { MOCK_CAPTCHA } from '../captcha/test/utils';
import { MOCK_PASSWORD, saveMemberAndPassword } from '../password/test/fixtures/password';

jest.mock('node-fetch');

// mock captcha
// bug: cannot use exported mockCaptchaValidation
const mockCaptchaValidation = (action: RecaptchaActionType) => {
  (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { json: async () => ({ success: true, action, score: 1 }) } as Response;
  });
};

// mock database and decorator plugins
jest.mock('../../../../plugins/datasource');

const challenge = 'challenge';
describe('Mobile Endpoints', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    ({ app } = await build({ member: null }));
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    await app.close();
  });

  describe('POST /m/register', () => {
    beforeEach(() => {
      // mock captcha validation
      mockCaptchaValidation(RecaptchaAction.SignUpMobile);
    });

    it('Sign Up successfully', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/register',
        payload: { email, name, challenge, captcha: MOCK_CAPTCHA },
      });

      const m = await MemberRepository.findOneBy({ email });
      expectMember(m, { email, name });

      // ensure that the user agreements are set for new registration
      expect(m?.userAgreementsDate).toBeDefined();
      expect(m?.userAgreementsDate).toBeInstanceOf(Date);

      expect(mockSendEmail).toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign Up successfully with given lang', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      const lang = 'fr';
      const member = { email, name, extra: { lang } };

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/m/register?lang=${lang}`,
        payload: { email, name, challenge, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );

      const m = await MemberRepository.findOneBy({ email });
      expectMember(m, member);
      // ensure that the user agreements are set for new registration
      expect(m?.userAgreementsDate).toBeDefined();
      expect(m?.userAgreementsDate).toBeInstanceOf(Date);
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Save actions is disabled when explicitly asked', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      const enableSaveActions = false;

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/register',
        payload: { email, name, challenge, captcha: MOCK_CAPTCHA, enableSaveActions },
      });

      const m = await MemberRepository.findOneBy({ email });
      expectMember(m, { email, name });
      expect(m?.enableSaveActions).toBe(enableSaveActions);
      expect(mockSendEmail).toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Enable save actions when explicitly asked', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      const enableSaveActions = true;

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/register',
        payload: { email, name, challenge, enableSaveActions, captcha: MOCK_CAPTCHA },
      });

      const m = await MemberRepository.findOneBy({ email });
      expectMember(m, { email, name });
      expect(m?.enableSaveActions).toBe(enableSaveActions);
      expect(mockSendEmail).toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign Up fallback to login for already register member', async () => {
      const member = await saveMember();

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/register',
        payload: { ...member, challenge, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      const m = await MemberRepository.findOneBy({ email: member.email });
      expectMember(m, member);

      expect(response.statusCode).toEqual(StatusCodes.CONFLICT);
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const name = 'anna';
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/register',
        payload: { email, name, captcha: MOCK_CAPTCHA },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /m/login', () => {
    beforeEach(() => {
      // mock captcha validation
      mockCaptchaValidation(RecaptchaAction.SignInMobile);
    });
    it('Sign In successfully', async () => {
      const member = await saveMember();

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/login',
        payload: { email: member.email, challenge, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign In successfully with given lang', async () => {
      const lang = 'de';
      const member = await saveMember();

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/m/login?lang=${lang}`,
        payload: { email: member.email, challenge, captcha: MOCK_CAPTCHA },
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('Sign In does send not found error for non-existing email', async () => {
      const email = 'some@email.com';

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/login',
        payload: { email, challenge, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/login',
        payload: { email, challenge, captcha: MOCK_CAPTCHA },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /m/login-password', () => {
    beforeEach(() => {
      // mock captcha validation
      mockCaptchaValidation(RecaptchaAction.SignInWithPasswordMobile);
    });
    it('Sign In successfully', async () => {
      const member = MemberFactory();
      await saveMemberAndPassword(member, MOCK_PASSWORD);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/login-password',
        payload: {
          email: member.email,
          challenge,
          password: MOCK_PASSWORD.password,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      const result = await response.json();
      expect(result).toHaveProperty('resource');
      const url = new URL(`${MOBILE_DEEP_LINK_PROTOCOL}//auth`);
      url.searchParams.set('t', ''); // we don't know the generated token, but the parameter should exist
      expect(result.resource).toContain(url.toString());
    });

    it('Sign In successfully with captcha score = 0', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
        return {
          json: async () => ({
            success: true,
            action: RecaptchaAction.SignInWithPasswordMobile,
            score: 0,
          }),
        } as Response;
      });
      const member = MemberFactory();
      await saveMemberAndPassword(member, MOCK_PASSWORD);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/login-password',
        payload: {
          email: member.email,
          challenge,
          password: MOCK_PASSWORD.password,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      const result = await response.json();
      expect(result).toHaveProperty('resource');
      const url = new URL(`${MOBILE_DEEP_LINK_PROTOCOL}//auth`);
      url.searchParams.set('t', ''); // we don't know the generated token, but the parameter should exist
      expect(result.resource).toContain(url.toString());
    });

    it('Sign In successfully with captcha score < 0.5', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
        return {
          json: async () => ({
            success: true,
            action: RecaptchaAction.SignInWithPasswordMobile,
            score: 0.3,
          }),
        } as Response;
      });
      const member = MemberFactory();
      await saveMemberAndPassword(member, MOCK_PASSWORD);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/login-password',
        payload: {
          email: member.email,
          challenge,
          password: MOCK_PASSWORD.password,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      const result = await response.json();
      expect(result).toHaveProperty('resource');
      const url = new URL(`${MOBILE_DEEP_LINK_PROTOCOL}//auth`);
      url.searchParams.set('t', ''); // we don't know the generated token, but the parameter should exist
      expect(result.resource).toContain(url.toString());
    });

    it('Sign In does send unauthorized error for wrong password', async () => {
      const member = MemberFactory();
      const wrongPassword = '1234';
      await saveMemberAndPassword(member, MOCK_PASSWORD);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/login-password',
        payload: { email: member.email, challenge, password: wrongPassword, captcha: MOCK_CAPTCHA },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      expect(response.statusMessage).toEqual(ReasonPhrases.UNAUTHORIZED);
    });

    it('Sign In send not acceptable error when member does not have password', async () => {
      const clearPassword = 'asd';
      const member = await saveMember();

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/login-password',
        payload: { email: member.email, challenge, password: clearPassword, captcha: MOCK_CAPTCHA },
      });
      expect(response.statusCode).toEqual(StatusCodes.NOT_ACCEPTABLE);
      expect(response.statusMessage).toEqual(ReasonPhrases.NOT_ACCEPTABLE);
    });

    it('Sign In send not found error for non-existing email', async () => {
      const email = 'some@email.com';
      const password = '1234';

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/login-password',
        payload: { email, challenge, password, captcha: MOCK_CAPTCHA },
      });

      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(response.statusMessage).toEqual(ReasonPhrases.NOT_FOUND);
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const password = '1234';

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/login-password',
        payload: { email, challenge, password, captcha: MOCK_CAPTCHA },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('GET /m/auth', () => {
    it('Authenticate successfully', async () => {
      const member = await saveMember();
      const verifier = 'verifier';
      // compute challenge from verifier
      const challenge = crypto.createHash('sha256').update(verifier).digest('hex');

      const t = jwt.sign({ sub: member.id, challenge }, JWT_SECRET);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/auth',
        payload: {
          t,
          verifier,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json()).toHaveProperty('refreshToken');
      expect(response.json()).toHaveProperty('authToken');
    });

    it('Fail to authenticate if verifier and challenge do not match', async () => {
      const member = await saveMember();
      const t = jwt.sign({ sub: member.id }, JWT_SECRET);
      const verifier = 'verifier';
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/auth',
        payload: {
          t,
          verifier,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      expect(response.json().message).toEqual('challenge fail');
    });

    it('Fail to authenticate if token is invalid', async () => {
      const t = 'sometoken';
      const verifier = 'verifier';
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/auth',
        payload: {
          t,
          verifier,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    it('Fail to authenticate if token contains undefined member id', async () => {
      const verifier = 'verifier';
      // compute challenge from verifier
      const challenge = crypto.createHash('sha256').update(verifier).digest('hex');

      const t = jwt.sign({ sub: undefined, challenge }, JWT_SECRET);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/auth',
        payload: {
          t,
          verifier,
        },
      });

      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(response.json().message).toEqual(new MemberNotFound().message);
    });
  });

  describe('GET /m/auth/refresh', () => {
    it('Refresh tokens successfully', async () => {
      const member = await saveMember();
      const t = jwt.sign({ sub: member.id }, REFRESH_TOKEN_JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/m/auth/refresh',
        headers: {
          authorization: `Bearer ${t}`,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json()).toHaveProperty('refreshToken');
      expect(response.json()).toHaveProperty('authToken');
    });
    it('Throw if token contains undefined member id', async () => {
      const t = jwt.sign({ sub: undefined }, REFRESH_TOKEN_JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/m/auth/refresh',
        headers: {
          authorization: `Bearer ${t}`,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
    it('Fail if token is invalid', async () => {
      const member = await saveMember();
      const t = jwt.sign({ sub: member.id }, 'INVALID_SECRET');
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/m/auth/refresh',
        headers: {
          authorization: `Bearer ${t}`,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
  });
  describe('GET /m/auth/web', () => {
    it('set cookie for valid token', async () => {
      const member = await saveMember();
      const token = jwt.sign({ sub: member.id }, AUTH_TOKEN_JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/m/auth/web',
        query: { token },
      });
      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      expect(response.headers).toHaveProperty('set-cookie');
    });
    it('Throw if token contains undefined member id', async () => {
      const token = jwt.sign({ sub: undefined }, AUTH_TOKEN_JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/m/auth/web',
        query: { token },
      });
      expect(response.headers).not.toHaveProperty('set-cookie');
      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
    });
    it('Throw if token contains non-existent member', async () => {
      const memberId = v4();
      const token = jwt.sign({ sub: memberId }, AUTH_TOKEN_JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/m/auth/web',
        query: { token },
      });
      expect(response.headers).not.toHaveProperty('set-cookie');
      expect(response.json()).toMatchObject(new MemberNotFound(memberId));
    });
    it('Fail if token is invalid', async () => {
      const member = await saveMember();
      const token = jwt.sign({ sub: member.id }, 'INVALID_SECRET');
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/m/auth/web',
        query: { token },
      });
      expect(response.headers).not.toHaveProperty('set-cookie');
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
  });
});
