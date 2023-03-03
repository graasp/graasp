import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import * as MEMBERS_FIXTURES from '../../../../../test/fixtures/members';
import { MOCK_PASSWORD, saveMemberAndPassword } from '../../../../../test/fixtures/password';

// mock database and decorator plugins
jest.mock('../../../../plugins/datasource');

describe('Password routes tests', () => {
  let app;

  beforeEach(async () => {
    ({ app } = await build({ member: null }));
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);

    app.close();
  });

  describe('POST /login-password', () => {
    it('Sign In successfully', async () => {
      const m = MEMBERS_FIXTURES.LOUISA;
      const pwd = MOCK_PASSWORD;

      const member = await saveMemberAndPassword(m, pwd);

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login-password',
        payload: { email: member.email, password: pwd.password },
      });
      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      expect(response.json()).toHaveProperty('resource');
    });

    it('Sign In does send unauthorized error for wrong password', async () => {
      const member = MEMBERS_FIXTURES.LOUISA;
      const wrongPassword = '1234';
      await saveMemberAndPassword(member, MOCK_PASSWORD);

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login-password',
        payload: { email: member.email, password: wrongPassword },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      expect(response.statusMessage).toEqual(ReasonPhrases.UNAUTHORIZED);
    });

    it('Sign In does send not acceptable error when member does not have password', async () => {
      const member = MEMBERS_FIXTURES.BOB;
      const password = 'asd';
      await MEMBERS_FIXTURES.saveMember(member);

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login-password',
        payload: { email: member.email, password },
      });
      expect(response.statusCode).toEqual(StatusCodes.NOT_ACCEPTABLE);
      expect(response.statusMessage).toEqual(ReasonPhrases.NOT_ACCEPTABLE);
    });

    it('Sign In send not found error for non-existing email', async () => {
      const email = 'some@email.com';
      const password = '1234';
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login-password',
        payload: { email, password },
      });

      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(response.statusMessage).toEqual(ReasonPhrases.NOT_FOUND);
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const password = '1234';
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login-password',
        payload: { email, password },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });
});
