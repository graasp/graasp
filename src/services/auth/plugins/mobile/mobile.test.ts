import crypto from 'crypto';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

import { HttpMethod, RecaptchaAction, RecaptchaActionType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { JWT_SECRET, MOBILE_AUTH_URL, REFRESH_TOKEN_JWT_SECRET } from '../../../../utils/config';
import { MemberNotFound } from '../../../../utils/errors';
import MemberRepository from '../../../member/repository';
import { ANNA, BOB, LOUISA, expectMember, saveMember } from '../../../member/test/fixtures/members';
import { MOCK_CAPTCHA } from '../captcha/test/utils';
import { MOCK_PASSWORD, saveMemberAndPassword } from '../password/test/fixtures/password';

jest.mock('node-fetch');

// mock captcha
// bug: cannot use exported mockCaptchaValidation
export const mockCaptchaValidation = (action: RecaptchaActionType) => {
  (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
    return { json: async () => ({ success: true, action, score: 1 }) } as any;
  });
};

// mock database and decorator plugins
jest.mock('../../../../plugins/datasource');

const challenge = 'challenge';
describe('Mobile Endpoints', () => {
  let app;

  beforeEach(async () => {
    ({ app } = await build({ member: null }));
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

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/register',
        payload: { email, name, challenge, captcha: MOCK_CAPTCHA },
      });

      const m = await MemberRepository.findOneBy({ email });
      expectMember(m, { email, name });

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
        method: HttpMethod.POST,
        url: `/m/register?lang=${lang}`,
        payload: { email, name, challenge, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
        expect.anything(),
        expect.anything(),
      );

      const m = await MemberRepository.findOneBy({ email });
      expectMember(m, member);

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign Up fallback to login for already register member', async () => {
      const member = BOB;
      await saveMember(member);

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/register',
        payload: { ...member, challenge, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
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
        method: HttpMethod.POST,
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
      const member = BOB;
      await saveMember(member);

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/login',
        payload: { email: member.email, challenge, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
        expect.anything(),
        expect.anything(),
      );
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign In successfully with given lang', async () => {
      const member = ANNA;
      const lang = 'de';
      await saveMember(member);

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/m/login?lang=${lang}`,
        payload: { email: member.email, challenge, captcha: MOCK_CAPTCHA },
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
        expect.anything(),
        expect.anything(),
      );
    });

    it('Sign In does send not found error for non-existing email', async () => {
      const email = 'some@email.com';

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/login',
        payload: { email, challenge, captcha: MOCK_CAPTCHA },
      });

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const response = await app.inject({
        method: HttpMethod.POST,
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
      const member = LOUISA;
      await saveMemberAndPassword(member, MOCK_PASSWORD);

      const response = await app.inject({
        method: HttpMethod.POST,
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
      const url = new URL('/auth', MOBILE_AUTH_URL);
      url.searchParams.set('t', ''); // we don't know the generated token, but the parameter should exist
      expect(result.resource).toContain(url.toString());
    });

    it('Sign In does send unauthorized error for wrong password', async () => {
      const member = LOUISA;
      const wrongPassword = '1234';
      await saveMemberAndPassword(member, MOCK_PASSWORD);

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/login-password',
        payload: { email: member.email, challenge, password: wrongPassword, captcha: MOCK_CAPTCHA },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      expect(response.statusMessage).toEqual(ReasonPhrases.UNAUTHORIZED);
    });

    it('Sign In send not acceptable error when member does not have password', async () => {
      const member = BOB;
      const clearPassword = 'asd';
      await saveMember(member);

      const response = await app.inject({
        method: HttpMethod.POST,
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
        method: HttpMethod.POST,
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
        method: HttpMethod.POST,
        url: '/m/login-password',
        payload: { email, challenge, password, captcha: MOCK_CAPTCHA },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('GET /m/auth', () => {
    it('Authenticate successfully', async () => {
      const member = await saveMember(BOB);
      const verifier = 'verifier';
      // compute challenge from verifier
      const challenge = crypto.createHash('sha256').update(verifier).digest('hex');

      const t = jwt.sign({ sub: member.id, challenge }, JWT_SECRET);

      const response = await app.inject({
        method: HttpMethod.POST,
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
      const member = await saveMember(BOB);
      const t = jwt.sign({ sub: member.id }, JWT_SECRET);
      const verifier = 'verifier';
      const response = await app.inject({
        method: HttpMethod.POST,
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
        method: HttpMethod.POST,
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
        method: HttpMethod.POST,
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
      const member = await saveMember(BOB);
      const t = jwt.sign({ sub: member.id }, REFRESH_TOKEN_JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.GET,
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
        method: HttpMethod.GET,
        url: '/m/auth/refresh',
        headers: {
          authorization: `Bearer ${t}`,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
    it('Fail if token is invalid', async () => {
      const member = await saveMember(BOB);
      const t = jwt.sign({ sub: member.id }, 'REFRESH_TOKEN_JWT_SECRET');
      const response = await app.inject({
        method: HttpMethod.GET,
        url: '/m/auth/refresh',
        headers: {
          authorization: `Bearer ${t}`,
        },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
  });
});
