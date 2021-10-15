import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { mockMemberServiceCreate, mockMemberServiceGetMatching } from './mocks';
import * as MEMBERS_FIXTURES from './fixtures/members';
import build from './app';
import { JWT_SECRET, REFRESH_TOKEN_JWT_SECRET } from '../src/util/config';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { HTTP_METHODS } from './fixtures/utils';

// mock database and decorator plugins
jest.mock('../src/plugins/database');
jest.mock('../src/plugins/decorator');

describe('Auth routes tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('Sign Up successfully', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      const mockCreate = mockMemberServiceCreate();
      const app = await build();
      const mockSendRegisterEmail = jest.spyOn(app.mailer, 'sendRegisterEmail');
      const response = await app.inject({
        method: HTTP_METHODS.POST,
        url: '/register',
        payload: { email, name },
      });

      expect(mockSendRegisterEmail).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith({ email, name }, expect.anything());
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
      app.close();
    });
    it('Sign Up fallback to login for already register member', async () => {
      const member = MEMBERS_FIXTURES.BOB;
      const app =await build();
      const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
      mockMemberServiceGetMatching([member]);
      const mockCreate = mockMemberServiceCreate();
      const response = await app.inject({
        method: HTTP_METHODS.POST,
        url: '/register',
        payload: member,
      });

      expect(mockSendLoginEmail).toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.CONFLICT);
      app.close();
    });
    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const name = 'anna';
      const app =await build();
      const response = await app.inject({
        method: HTTP_METHODS.POST,
        url: '/register',
        payload: { email, name },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      app.close();
    });
  });

  describe('POST /login', () => {
    it('Sign In successfully', async () => {
      const member = MEMBERS_FIXTURES.BOB;
      mockMemberServiceGetMatching([member]);
      const app =await build();
      const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
      const response = await app.inject({
        method: HTTP_METHODS.POST,
        url: '/login',
        payload: { email: member.email },
      });

      expect(mockSendLoginEmail).toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
      app.close();
    });
    it('Sign In does send not found on non-existing email', async () => {
      const email = 'some@email.com';
      const app =await build();
      const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
      const response = await app.inject({
        method: HTTP_METHODS.POST,
        url: '/login',
        payload: { email },
      });

      expect(mockSendLoginEmail).not.toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      app.close();
    });
    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const app =await build();
      const response = await app.inject({
        method: HTTP_METHODS.POST,
        url: '/login',
        payload: { email },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      app.close();
    });
  });

  describe('GET /auth', () => {
    it('Authenticate successfully', async () => {
      const app =await build();
      const member = MEMBERS_FIXTURES.BOB;
      const t = jwt.sign(member, JWT_SECRET);
      mockMemberServiceGetMatching([member]);
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/auth?t=${t}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
      app.close();
    });
    it('Fail to authenticate if token is invalid', async () => {
      const app =await build();
      const member = MEMBERS_FIXTURES.BOB;
      const t = jwt.sign(member, 'secret');
      mockMemberServiceGetMatching([member]);
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: `/auth?t=${t}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      app.close();
    });
  });

  describe('GET /logout', () => {
    it('Authenticate successfully', async () => {
      const app =await build();
      const response = await app.inject({
        method: HTTP_METHODS.GET,
        url: '/logout',
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
      app.close();
    });
  });

  describe('Mobile Endpoints', () => {
    const challenge = 'challenge';

    describe('POST /m/register', () => {
      it('Sign Up successfully', async () => {
        const email = 'someemail@email.com';
        const name = 'anna';
        const mockCreate = mockMemberServiceCreate();
        const app =await build();
        const mockSendRegisterEmail = jest.spyOn(app.mailer, 'sendRegisterEmail');
        const response = await app.inject({
          method: HTTP_METHODS.POST,
          url: '/m/register',
          payload: { email, name, challenge },
        });

        expect(mockSendRegisterEmail).toHaveBeenCalled();
        expect(mockCreate).toHaveBeenCalledWith({ email, name }, expect.anything());
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        app.close();
      });
      it('Sign Up fallback to login for already register member', async () => {
        const member = MEMBERS_FIXTURES.BOB;
        const app =await build();
        const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
        mockMemberServiceGetMatching([member]);
        const mockCreate = mockMemberServiceCreate();
        const response = await app.inject({
          method: HTTP_METHODS.POST,
          url: '/m/register',
          payload: { ...member, challenge },
        });

        expect(mockSendLoginEmail).toHaveBeenCalled();
        expect(mockCreate).not.toHaveBeenCalled();
        expect(response.statusCode).toEqual(StatusCodes.CONFLICT);
        app.close();
      });
      it('Bad request for invalid email', async () => {
        const email = 'wrongemail';
        const name = 'anna';
        const app =await build();
        const response = await app.inject({
          method: HTTP_METHODS.POST,
          url: '/m/register',
          payload: { email, name },
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        app.close();
      });
    });

    describe('POST /login', () => {
      it('Sign In successfully', async () => {
        const member = MEMBERS_FIXTURES.BOB;
        mockMemberServiceGetMatching([member]);
        const app =await build();
        const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
        const response = await app.inject({
          method: HTTP_METHODS.POST,
          url: '/m/login',
          payload: { email: member.email, challenge },
        });

        expect(mockSendLoginEmail).toHaveBeenCalled();
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        app.close();
      });
      it('Sign In does send not found error for non-existing email', async () => {
        const email = 'some@email.com';
        const app =await build();
        const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
        const response = await app.inject({
          method: HTTP_METHODS.POST,
          url: '/m/login',
          payload: { email, challenge },
        });

        expect(mockSendLoginEmail).not.toHaveBeenCalled();
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
        app.close();
      });
      it('Bad request for invalid email', async () => {
        const email = 'wrongemail';
        const app =await build();
        const response = await app.inject({
          method: HTTP_METHODS.POST,
          url: '/m/login',
          payload: { email, challenge },
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        app.close();
      });
    });

    describe('GET /auth', () => {
      it('Authenticate successfully', async () => {
        const member = MEMBERS_FIXTURES.BOB;
        const verifier = 'verifier';
        // compute challenge from verifier
        const challenge = crypto.createHash('sha256').update(verifier).digest('hex');
        // mock verification
        jest.spyOn(jwt, 'verify').mockImplementation(() => {
          return { sub: member.id, challenge };
        });

        const app =await build();
        const t = jwt.sign({ sub: member.id, challenge }, JWT_SECRET);

        const response = await app.inject({
          method: HTTP_METHODS.POST,
          url: '/m/auth',
          payload: {
            t,
            verifier,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json()).toHaveProperty('refreshToken');
        expect(response.json()).toHaveProperty('authToken');
        app.close();
      });
      it('Fail to authenticate if verifier and challenge do not match', async () => {
        const app =await build();
        const member = MEMBERS_FIXTURES.BOB;
        const t = jwt.sign(member, JWT_SECRET);
        const verifier = 'verifier';
        const response = await app.inject({
          method: HTTP_METHODS.POST,
          url: '/m/auth',
          payload: {
            t,
            verifier,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
        expect(response.json().message).toEqual('challenge fail');
        app.close();
      });
      it('Fail to authenticate if token is invalid', async () => {
        const app =await build();
        const t = 'sometoken';
        const verifier = 'verifier';
        const response = await app.inject({
          method: HTTP_METHODS.POST,
          url: '/m/auth',
          payload: {
            t,
            verifier,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
        app.close();
      });
    });

    describe('GET /m/auth/refresh', () => {
      it('Refresh tokens successfully', async () => {
        const app =await build();
        const member = MEMBERS_FIXTURES.BOB;
        const t = jwt.sign(member, REFRESH_TOKEN_JWT_SECRET);
        const response = await app.inject({
          method: HTTP_METHODS.GET,
          url: '/m/auth/refresh',
          headers: {
            authorization: `Bearer ${t}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json()).toHaveProperty('refreshToken');
        expect(response.json()).toHaveProperty('authToken');
        app.close();
      });
      it('Fail if token is invalid', async () => {
        const app =await build();
        const member = MEMBERS_FIXTURES.BOB;
        const t = jwt.sign(member, 'REFRESH_TOKEN_JWT_SECRET');
        const response = await app.inject({
          method: HTTP_METHODS.GET,
          url: '/m/auth/refresh',
          headers: {
            authorization: `Bearer ${t}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
        app.close();
      });
    });

    describe('GET /m/deep-link', () => {
      it('Refresh tokens successfully', async () => {
        const app =await build();
        const member = MEMBERS_FIXTURES.BOB;
        const t = jwt.sign(member, JWT_SECRET);
        const response = await app.inject({
          method: HTTP_METHODS.GET,
          url: `/m/deep-link?t=${t}`,
        });
        expect(response.headers['content-type']).toEqual('text/html');
        expect(response.statusCode).toEqual(StatusCodes.OK);
        app.close();
      });
    });
  });
});
