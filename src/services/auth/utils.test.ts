import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import build, { clearDatabase } from '../../../test/app';
import { AUTH_TOKEN_JWT_SECRET } from '../../utils/config';
import { saveMember } from '../member/test/fixtures/members';
import { authenticateMobileMagicLink } from './plugins/passport';

// mock datasource
jest.mock('../../plugins/datasource');
const MOCKED_ROUTE = '/mock-route';

describe('Auth utils', () => {
  let app: FastifyInstance;
  let member;
  let fn: jest.Mock;
  beforeAll(async () => {
    ({ app } = await build());
    fn = jest.fn();
    app.get(MOCKED_ROUTE, { preHandler: authenticateMobileMagicLink }, async (...args) => {
      fn(...args);
    });

    member = await saveMember();
  });

  afterAll(async () => {
    await clearDatabase(app.db);
  });

  afterEach(() => {
    fn.mockClear();
  });

  describe('verifyMemberInAuthToken', () => {
    const verifier = 'verifier';
    const challenge = crypto.createHash('sha256').update(verifier).digest('hex');

    it('Correctly set member in request', async () => {
      const token = jwt.sign({ sub: member.id, challenge }, AUTH_TOKEN_JWT_SECRET);
      fn.mockImplementation(({ user }) => expect(user!.member).toEqual(member));
      const response = await app.inject({ path: MOCKED_ROUTE, query: { token } });
      expect(fn).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    it('No memberId throw unauthorized', async () => {
      const token = jwt.sign({ sub: undefined, challenge }, AUTH_TOKEN_JWT_SECRET);
      fn.mockImplementation(() => fail('Should not be called'));
      const response = await app.inject({ path: MOCKED_ROUTE, query: { token } });
      expect(fn).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('If member does not exist throw unauthorized', async () => {
      const token = jwt.sign({ sub: v4(), challenge }, AUTH_TOKEN_JWT_SECRET);
      fn.mockImplementation(() => fail('Should not be called'));
      const response = await app.inject({ path: MOCKED_ROUTE, query: { token } });
      expect(fn).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
  });
});
