import { faker } from '@faker-js/faker';
import crypto from 'crypto';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { sign } from 'jsonwebtoken';
import fetch, { type Response } from 'node-fetch';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, MemberFactory, RecaptchaAction, RecaptchaActionType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { resolveDependency } from '../../../../di/utils';
import { AppDataSource } from '../../../../plugins/datasource';
import { MailerService } from '../../../../plugins/mailer/service';
import {
  AUTH_TOKEN_JWT_SECRET,
  JWT_SECRET,
  MOBILE_DEEP_LINK_PROTOCOL,
  REFRESH_TOKEN_JWT_SECRET,
} from '../../../../utils/config';
import { MemberNotFound } from '../../../../utils/errors';
import { Member } from '../../../member/entities/member';
import { expectMember, saveMember } from '../../../member/test/fixtures/members';
import { MOCK_CAPTCHA } from '../captcha/test/utils';
import { SHORT_TOKEN_PARAM } from '../passport';
import { MOCK_PASSWORD, saveMemberAndPassword } from '../password/test/fixtures/password';

jest.mock('node-fetch');
const memberRawRepository = AppDataSource.getRepository(Member);

// mock captcha
// bug: cannot use exported mockCaptchaValidation
const mockCaptchaValidation = (action: RecaptchaActionType) => {
  (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { json: async () => ({ success: true, action, score: 1 }) } as Response;
  });
};

const challenge = 'challenge';
describe('Mobile Endpoints', () => {
  let app: FastifyInstance;
  let mailerService: MailerService;

  beforeEach(async () => {
    ({ app } = await build({ member: null }));
    mailerService = resolveDependency(MailerService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('POST /m/register', () => {
    beforeEach(() => {
      // mock captcha validation
      mockCaptchaValidation(RecaptchaAction.SignUpMobile);
    });

    it('Sign Up successfully', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';

      const mockSendEmail = jest.spyOn(mailerService, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/register',
        payload: { email, name, challenge, captcha: MOCK_CAPTCHA },
      });

      const m = await memberRawRepository.findOneBy({ email });
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

      const mockSendEmail = jest.spyOn(mailerService, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/m/register?lang=${lang}`,
        payload: { email, name, challenge, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail.mock.calls[0][1]).toBe(member.email);

      const m = await memberRawRepository.findOneBy({ email });
      expectMember(m, member);
      // ensure that the user agreements are set for new registration
      expect(m?.userAgreementsDate).toBeDefined();
      expect(m?.userAgreementsDate).toBeInstanceOf(Date);
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Save actions are disabled when explicitly asked', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      const enableSaveActions = false;

      const mockSendEmail = jest.spyOn(mailerService, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/register',
        payload: { email, name, challenge, captcha: MOCK_CAPTCHA, enableSaveActions },
      });

      const m = await memberRawRepository.findOneBy({ email });
      expectMember(m, { email, name });
      expect(m?.enableSaveActions).toBe(enableSaveActions);
      expect(mockSendEmail).toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Enable save actions when explicitly asked', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      const enableSaveActions = true;

      const mockSendEmail = jest.spyOn(mailerService, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/register',
        payload: { email, name, challenge, enableSaveActions, captcha: MOCK_CAPTCHA },
      });

      const m = await memberRawRepository.findOneBy({ email });
      expectMember(m, { email, name });
      expect(m?.enableSaveActions).toBe(enableSaveActions);
      expect(mockSendEmail).toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign Up fallback to login for already register member', async () => {
      const member = await saveMember();

      const mockSendEmail = jest.spyOn(mailerService, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/register',
        payload: { ...member, challenge, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail.mock.calls[0][1]).toBe(member.email);

      const m = await memberRawRepository.findOneBy({ email: member.email });
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

    it('Bad request for invalid username', async () => {
      const email = faker.internet.email().toLowerCase();
      const name = '<divvy> "\'';
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

      const mockSendEmail = jest.spyOn(mailerService, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/m/login',
        payload: { email: member.email, challenge, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail.mock.calls[0][1]).toBe(member.email);
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign In successfully with given lang', async () => {
      const lang = 'de';
      const member = await saveMember();

      const mockSendEmail = jest.spyOn(mailerService, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/m/login?lang=${lang}`,
        payload: { email: member.email, challenge, captcha: MOCK_CAPTCHA },
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
      expect(mockSendEmail.mock.calls[0][1]).toBe(member.email);
    });

    it('Sign In does send not found error for non-existing email', async () => {
      const email = 'some@email.com';

      const mockSendEmail = jest.spyOn(mailerService, 'sendEmail');
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

      const t = sign({ sub: member.id, challenge }, JWT_SECRET);

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
      const t = sign({ sub: member.id }, JWT_SECRET);
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
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });

    it('Fail to authenticate if token contains undefined member id', async () => {
      const verifier = 'verifier';
      // compute challenge from verifier
      const challenge = crypto.createHash('sha256').update(verifier).digest('hex');

      const t = sign({ sub: undefined, challenge }, JWT_SECRET);

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
      const t = sign({ sub: member.id }, REFRESH_TOKEN_JWT_SECRET);
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
      const t = sign({ sub: undefined }, REFRESH_TOKEN_JWT_SECRET);
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
      const t = sign({ sub: member.id }, 'INVALID_SECRET');
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
      const token = sign({ sub: member.id }, AUTH_TOKEN_JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/m/auth/web',
        query: { token },
      });
      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      expect(response.headers).toHaveProperty('set-cookie');
    });
    it('Throw if token contains undefined member id', async () => {
      const token = sign({ sub: undefined }, AUTH_TOKEN_JWT_SECRET);
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
      const token = sign({ sub: memberId }, AUTH_TOKEN_JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/m/auth/web',
        query: { token },
      });
      expect(response.headers).not.toHaveProperty('set-cookie');
      expect(response.json()).toMatchObject(new MemberNotFound({ id: memberId }));
    });
    it('Fail if token is invalid', async () => {
      const member = await saveMember();
      const token = sign({ sub: member.id }, 'INVALID_SECRET');
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/m/auth/web',
        query: { token },
      });
      expect(response.headers).not.toHaveProperty('set-cookie');
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('Complete Authentication Process', () => {
    let verifier;
    let challenge;
    beforeEach(() => {
      verifier = 'verifier';
      challenge = crypto.createHash('sha256').update(verifier).digest('hex');
    });
    it('MagicLink', async () => {
      mockCaptchaValidation(RecaptchaAction.SignUpMobile);
      const mockSendEmail = jest.spyOn(resolveDependency(MailerService), 'sendEmail');

      const username = faker.internet.userName().toLowerCase();
      const email = faker.internet.email().toLowerCase();

      const responseRegister = await app.inject({
        method: HttpMethod.Post,
        url: '/m/register',
        payload: {
          name: username,
          email,
          challenge,
          captcha: MOCK_CAPTCHA,
        },
      });
      let m = await memberRawRepository.findOneBy({ email });
      expect(m?.lastAuthenticatedAt).toBeNull();
      expect(m?.isValidated).toBeFalsy();

      expect(responseRegister.statusCode).toBe(StatusCodes.NO_CONTENT);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);

      const tokenRegex = /\?t=([\w\-\.]{1,1000})/;
      const token = mockSendEmail.mock.calls[0][2].match(tokenRegex)![1];

      const responseAuth = await app.inject({
        method: HttpMethod.Post,
        url: `/m/auth`,
        payload: {
          [SHORT_TOKEN_PARAM]: token,
          verifier,
        },
      });
      expect(responseAuth.statusCode).toBe(StatusCodes.OK);

      m = await memberRawRepository.findOneBy({ email });
      expect(m?.lastAuthenticatedAt).toBeDefined();
      expect(m?.isValidated).toBeTruthy();

      const responseAuthBody = responseAuth.json();
      expect(responseAuthBody).toHaveProperty('refreshToken');
      expect(responseAuthBody).toHaveProperty('authToken');

      const responseCheck = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current',
        headers: {
          authorization: `Bearer ${responseAuthBody.authToken}`,
        },
      });

      expect(responseCheck.statusCode).toBe(StatusCodes.OK);
      const responseCheckBody = responseCheck.json();
      expect(responseCheckBody).toHaveProperty('id');
      expect(responseCheckBody.email).toBe(email);
      expect(responseCheckBody.name).toBe(username);
    });
    it('Password', async () => {
      mockCaptchaValidation(RecaptchaAction.SignInWithPasswordMobile);

      const member = await saveMemberAndPassword(
        MemberFactory({ isValidated: false }),
        MOCK_PASSWORD,
      );

      const responseLogin = await app.inject({
        method: HttpMethod.Post,
        url: '/m/login-password',
        payload: {
          email: member.email,
          challenge,
          password: MOCK_PASSWORD.password,
          captcha: MOCK_CAPTCHA,
        },
      });
      expect(responseLogin.statusCode).toBe(StatusCodes.SEE_OTHER);
      const responseLoginBody = responseLogin.json();
      const authUrl = new URL(responseLoginBody.resource);

      let m = await memberRawRepository.findOneBy({ email: member.email });
      expect(m?.lastAuthenticatedAt).toBeNull();
      expect(m?.isValidated).toBeFalsy();
      const responseAuth = await app.inject({
        method: HttpMethod.Post,
        url: `/m/auth`,
        payload: {
          [SHORT_TOKEN_PARAM]: authUrl.searchParams.get(SHORT_TOKEN_PARAM)!,
          verifier,
        },
      });

      expect(responseAuth.statusCode).toBe(StatusCodes.OK);

      m = await memberRawRepository.findOneBy({ email: member.email });
      expect(m?.lastAuthenticatedAt).toBeDefined();
      expect(m?.isValidated).toBeFalsy();

      const responseAuthBody = responseAuth.json();
      expect(responseAuthBody).toHaveProperty('refreshToken');
      expect(responseAuthBody).toHaveProperty('authToken');

      const responseCheck = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current',
        headers: {
          authorization: `Bearer ${responseAuthBody.authToken}`,
        },
      });

      expect(responseCheck.statusCode).toBe(StatusCodes.OK);
      const responseCheckBody = responseCheck.json();
      expect(responseCheckBody).toHaveProperty('id');
      expect(responseCheckBody.email).toBe(member.email);
      expect(responseCheckBody.name).toBe(member.name);
    });
  });
});
