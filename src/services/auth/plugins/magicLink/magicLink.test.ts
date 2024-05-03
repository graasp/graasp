import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import {
  HttpMethod,
  MAX_USERNAME_LENGTH,
  MemberFactory,
  RecaptchaAction,
  RecaptchaActionType,
} from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

import build, { clearDatabase } from '../../../../../test/app';
import { AUTH_CLIENT_HOST, JWT_SECRET } from '../../../../utils/config';
import MemberRepository from '../../../member/repository';
import { expectMember, saveMember } from '../../../member/test/fixtures/members';
import { MOCK_CAPTCHA } from '../captcha/test/utils';

jest.mock('node-fetch');

// mock captcha
// bug: cannot use exported mockCaptchaValidation
export const mockCaptchaValidation = (action: RecaptchaActionType) => {
  (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { json: async () => ({ success: true, action, score: 1 }) } as any;
  });
};

// mock database and decorator plugins
jest.mock('../../../../plugins/datasource');

describe('Auth routes tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    ({ app } = await build({ member: null }));
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('POST /register', () => {
    beforeEach(() => {
      // mock captcha validation
      mockCaptchaValidation(RecaptchaAction.SignUp);
    });

    it('Sign Up successfully', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/register',
        payload: { email, name, captcha: MOCK_CAPTCHA },
      });
      const m = await MemberRepository.findOneBy({ email, name });

      expectMember(m, { name, email });

      // ensure that the user agreements are set for new registration
      expect(m?.userAgreementsDate).toBeDefined();
      expect(m?.userAgreementsDate).toBeInstanceOf(Date);

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        email,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('Sign Up successfully with given lang', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      const lang = 'fr';

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/register?lang=${lang}`,
        payload: { email, name, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        email,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      const m = await MemberRepository.findOneBy({ email, name });
      expectMember(m, { name, email, extra: { lang } });
      // ensure that the user agreements are set for new registration
      expect(m?.userAgreementsDate).toBeDefined();
      expect(m?.userAgreementsDate).toBeInstanceOf(Date);
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Rejects if username is too long', async () => {
      const email = 'some@email.com';
      const name = Array(MAX_USERNAME_LENGTH + 1).fill(() => 'a');

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/register`,
        payload: { email, name, captcha: MOCK_CAPTCHA },
      });

      const m = await MemberRepository.findOneBy({ email });
      expect(m).toBeFalsy();
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });

    it('Save actions is disabled when explicitly asked', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      const enableSaveActions = false;

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/register`,
        payload: { email, name, captcha: MOCK_CAPTCHA, enableSaveActions },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        email,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      const m = await MemberRepository.findOneBy({ email, name });
      expectMember(m, { name, email });
      expect(m?.enableSaveActions).toBe(enableSaveActions);
      // ensure that the user agreements are set for new registration
      expect(m?.userAgreementsDate).toBeDefined();
      expect(m?.userAgreementsDate).toBeInstanceOf(Date);
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Enable save actions when explicitly asked', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      const enableSaveActions = true;

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/register`,
        payload: { email, name, enableSaveActions, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        email,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
      const m = await MemberRepository.findOneBy({ email, name });
      expectMember(m, { name, email });
      expect(m?.enableSaveActions).toBe(enableSaveActions);
      // ensure that the user agreements are set for new registration
      expect(m?.userAgreementsDate).toBeDefined();
      expect(m?.userAgreementsDate).toBeInstanceOf(Date);
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign Up fallback to login for already register member', async () => {
      // register already existing member
      const member = await saveMember();
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/register',
        payload: { ...member, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );

      const members = await MemberRepository.findBy({ email: member.email });
      expect(members).toHaveLength(1);
      expectMember(member, members[0]);

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const name = 'anna';
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/register',
        payload: { email, name, captcha: MOCK_CAPTCHA },
      });

      const members = await MemberRepository.findBy({ email });
      expect(members).toHaveLength(0);

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /login', () => {
    beforeEach(() => {
      // mock captcha validation
      mockCaptchaValidation(RecaptchaAction.SignIn);
    });
    it('Sign In successfully', async () => {
      const member = await saveMember();
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/login',
        payload: { email: member.email, captcha: MOCK_CAPTCHA },
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
      const member = await saveMember(MemberFactory({ extra: { lang: 'fr' } }));
      const { lang } = member.extra;
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/login?lang=${lang}`,
        payload: { email: member.email, captcha: MOCK_CAPTCHA },
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

    it('Sign In does send not found on non-existing email', async () => {
      const email = 'some@email.com';

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/login',
        payload: { email, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      app.close();
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/login',
        payload: { email, captcha: MOCK_CAPTCHA },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });

    it('Bad request for non registered email', async () => {
      // email is not registered
      const email = 'tim@graasp.org';
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/login',
        payload: { email, captcha: MOCK_CAPTCHA },
      });

      // ensure the message is `member not signed up`
      expect(response.json().message).toEqual(FAILURE_MESSAGES.MEMBER_NOT_SIGNED_UP);
      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
    });
  });

  describe('GET /auth', () => {
    it('Authenticate successfully', async () => {
      const member = await saveMember();
      const t = jwt.sign({ sub: member.id }, JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/auth?t=${t}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      expect(response.headers.location).not.toContain('error');
    });

    it('Fail if token contains undefined memberId', async () => {
      const t = jwt.sign({ sub: undefined }, JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/auth?t=${t}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      const url = new URL('/', AUTH_CLIENT_HOST);
      url.searchParams.set('error', 'true');
      expect(response.headers.location).toEqual(url.toString());
    });

    it('Fail if token contains unknown member id', async () => {
      const t = jwt.sign({ sub: v4() }, JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/auth?t=${t}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      const url = new URL('/', AUTH_CLIENT_HOST);
      url.searchParams.set('error', 'true');
      expect(response.headers.location).toEqual(url.toString());
    });

    it('Fail to authenticate if token is invalid', async () => {
      const member = await saveMember();
      const t = jwt.sign({ sub: member.id }, 'secret');
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/auth?t=${t}`,
      });

      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      const url = new URL('/', AUTH_CLIENT_HOST);
      url.searchParams.set('error', 'true');
      expect(response.headers.location).toEqual(url.toString());
    });
  });

  describe('GET /logout', () => {
    it('Authenticate successfully', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/logout',
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });
  });
});
