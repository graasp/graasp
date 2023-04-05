import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { JWT_SECRET } from '../../../../util/config';
import MemberRepository from '../../../member/repository';
import { ANNA, BOB, expectMember, saveMember } from '../../../member/test/fixtures/members';


// mock database and decorator plugins
jest.mock('../../../../plugins/datasource');

describe('Auth routes tests', () => {
  let app;

  beforeEach(async () => {
    ({ app } = await build({ member: null }));
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('POST /register', () => {
    it('Sign Up successfully', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/register',
        payload: { email, name },
      });
      const m = await MemberRepository.findOneBy({ email, name });

      expectMember(m, { name, email });

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        email,
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
        method: HttpMethod.POST,
        url: `/register?lang=${lang}`,
        payload: { email, name },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        email,
        expect.anything(),
        expect.anything(),
      );
      const m = await MemberRepository.findOneBy({ email, name });
      expectMember(m, { name, email, extra: { lang } });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign Up fallback to login for already register member', async () => {
      // register already existing member
      const member = await saveMember(BOB);
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/register',
        payload: member,
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
        expect.anything(),
        expect.anything(),
      );

      const members = await MemberRepository.findBy({ email: member.email });
      expect(members).toHaveLength(1);
      expectMember(member, members[0]);

      expect(response.statusCode).toEqual(StatusCodes.CONFLICT);
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const name = 'anna';
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/register',
        payload: { email, name },
      });

      const members = await MemberRepository.findBy({ email });
      expect(members).toHaveLength(0);

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /login', () => {
    it('Sign In successfully', async () => {
      const member = await saveMember(BOB);
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login',
        payload: { email: member.email },
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
      const member = await saveMember(ANNA);
      const { lang } = member.extra;
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/login?lang=${lang}`,
        payload: { email: member.email },
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.anything(),
        member.email,
        expect.anything(),
        expect.anything(),
      );
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign In does send not found on non-existing email', async () => {
      const email = 'some@email.com';

      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login',
        payload: { email },
      });

      expect(mockSendEmail).not.toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      app.close();
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login',
        payload: { email },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('GET /auth', () => {
    it('Authenticate successfully', async () => {
      const member = await saveMember(BOB);
      const t = jwt.sign({ id: member.id }, JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/auth?t=${t}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Fail to authenticate if token is invalid', async () => {
      const member = await saveMember(BOB);
      const t = jwt.sign({ id: member.id }, 'secret');
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/auth?t=${t}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('GET /logout', () => {
    it('Authenticate successfully', async () => {
      const response = await app.inject({
        method: HttpMethod.GET,
        url: '/logout',
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });
  });
});
