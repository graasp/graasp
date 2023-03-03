import crypto from 'crypto';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import * as MEMBERS_FIXTURES from '../../../../../test/fixtures/members';
import { MOCK_PASSWORD, saveMemberAndPassword } from '../../../../../test/fixtures/password';
import { JWT_SECRET, REFRESH_TOKEN_JWT_SECRET } from '../../../../util/config';
import MemberRepository from '../../../member/repository';

const { saveMember } = MEMBERS_FIXTURES;

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
    it('Sign Up successfully', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/register',
        payload: { email, name, challenge },
      });

      const m = await MemberRepository.findOneBy({ email });
      MEMBERS_FIXTURES.expectMember(m, { email, name });

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
        payload: { email, name, challenge },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
        expect.anything(),
        expect.anything(),
      );

      const m = await MemberRepository.findOneBy({ email });
      MEMBERS_FIXTURES.expectMember(m, member);

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign Up fallback to login for already register member', async () => {
      const member = MEMBERS_FIXTURES.BOB;
      await saveMember(member);

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/register',
        payload: { ...member, challenge },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
        expect.anything(),
        expect.anything(),
      );
      const m = await MemberRepository.findOneBy({ email: member.email });
      MEMBERS_FIXTURES.expectMember(m, member);

      expect(response.statusCode).toEqual(StatusCodes.CONFLICT);
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const name = 'anna';
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/register',
        payload: { email, name },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /m/login', () => {
    it('Sign In successfully', async () => {
      const member = MEMBERS_FIXTURES.BOB;
      await saveMember(member);

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/login',
        payload: { email: member.email, challenge },
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
      const member = MEMBERS_FIXTURES.ANNA;
      const lang = 'de';
      await saveMember(member);

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/m/login?lang=${lang}`,
        payload: { email: member.email, challenge },
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
        payload: { email, challenge },
      });

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/login',
        payload: { email, challenge },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /m/login-password', () => {
    it('Sign In successfully', async () => {
      const member = MEMBERS_FIXTURES.LOUISA;
      await saveMemberAndPassword(member, MOCK_PASSWORD);

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/login-password',
        payload: { email: member.email, challenge, password: MOCK_PASSWORD.password },
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json()).toHaveProperty('t');
    });

    it('Sign In does send unauthorized error for wrong password', async () => {
      const member = MEMBERS_FIXTURES.LOUISA;
      const wrongPassword = '1234';
      await saveMemberAndPassword(member, MOCK_PASSWORD);

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/login-password',
        payload: { email: member.email, challenge, password: wrongPassword },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      expect(response.statusMessage).toEqual(ReasonPhrases.UNAUTHORIZED);
    });

    it('Sign In send not acceptable error when member does not have password', async () => {
      const member = MEMBERS_FIXTURES.BOB;
      const clearPassword = 'asd';
      await saveMember(member);

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/m/login-password',
        payload: { email: member.email, challenge, password: clearPassword },
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
        payload: { email, challenge, password },
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
        payload: { email, challenge, password },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('GET /m/auth', () => {
    it('Authenticate successfully', async () => {
      const member = await saveMember(MEMBERS_FIXTURES.BOB);
      const verifier = 'verifier';
      // compute challenge from verifier
      const challenge = crypto.createHash('sha256').update(verifier).digest('hex');
      // mock verification
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        return { sub: member.id, challenge };
      });

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
      const member = await saveMember(MEMBERS_FIXTURES.BOB);
      const t = jwt.sign({ id: member.id }, JWT_SECRET);
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
  });

  describe('GET /m/auth/refresh', () => {
    it('Refresh tokens successfully', async () => {
      const member = await saveMember(MEMBERS_FIXTURES.BOB);
      const t = jwt.sign({ id: member.id }, REFRESH_TOKEN_JWT_SECRET);
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
    it('Fail if token is invalid', async () => {
      const member = await saveMember(MEMBERS_FIXTURES.BOB);
      const t = jwt.sign({ id: member.id }, 'REFRESH_TOKEN_JWT_SECRET');
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

  describe('GET /m/deep-link', () => {
    it('Refresh tokens successfully', async () => {
      const member = await saveMember(MEMBERS_FIXTURES.BOB);
      const t = jwt.sign({ id: member.id }, JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/m/deep-link?t=${t}`,
      });
      expect(response.headers['content-type']).toEqual('text/html');
      expect(response.statusCode).toEqual(StatusCodes.OK);
    });
  });
});
