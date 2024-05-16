import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 } from 'uuid';

import { FastifyInstance, FastifyRequest } from 'fastify';

import build, { clearDatabase } from '../../../test/app';
import { AUTH_TOKEN_JWT_SECRET } from '../../utils/config';
import { InvalidSession, MemberNotFound, OrphanSession } from '../../utils/errors';
import { Member } from '../member/entities/member';
import { saveMember } from '../member/test/fixtures/members';
import { fetchMemberInSession, verifyMemberInAuthToken, verifyMemberInSession } from './utils';

// mock datasource
jest.mock('../../plugins/datasource');

const buildRequest = (memberId?: string) =>
  ({
    session: {
      get: () => memberId,
      delete: jest.fn(),
    },
    log: { warn: jest.fn() },
  } as unknown as FastifyRequest & { member?: Member });

describe('Auth utils', () => {
  let app: FastifyInstance;
  let member;
  beforeAll(async () => {
    ({ app } = await build());

    member = await saveMember();
  });

  afterAll(async () => {
    await clearDatabase(app.db);
  });
  describe('verifyMemberInSession', () => {
    it('Correctly set member in request', async () => {
      const request = buildRequest(member.id);
      await verifyMemberInSession(request);

      expect(request.member).toEqual(member);
    });
    it('Throw for undefined memberId', async () => {
      const request = buildRequest();
      await expect(verifyMemberInSession(request)).rejects.toBeInstanceOf(InvalidSession);

      expect(request.member).toBeUndefined();
    });
    it('Throw if member does not exist', async () => {
      const request = buildRequest(v4());
      await expect(verifyMemberInSession(request)).rejects.toBeInstanceOf(OrphanSession);

      expect(request.member).toBeUndefined();
    });
  });

  describe('fetchMemberInSession', () => {
    it('Correctly set member in request', async () => {
      const request = buildRequest(member.id);
      await fetchMemberInSession(request);

      expect(request.member).toEqual(member);
    });
    it('No memberId does not throw', async () => {
      const request = buildRequest();
      await fetchMemberInSession(request);

      expect(request.member).toBeUndefined();
    });
    it('Throw if member does not exist', async () => {
      const request = buildRequest(v4());
      await expect(fetchMemberInSession(request)).rejects.toBeInstanceOf(MemberNotFound);

      expect(request.member).toBeUndefined();
    });
  });

  describe('verifyMemberInAuthToken', () => {
    const verifier = 'verifier';
    const challenge = crypto.createHash('sha256').update(verifier).digest('hex');

    it('Correctly set member in request', async () => {
      const request = buildRequest();

      const t = jwt.sign({ sub: member.id, challenge }, AUTH_TOKEN_JWT_SECRET);
      expect(await verifyMemberInAuthToken(t, request)).toBeTruthy();

      expect(request.member).toEqual(member);
    });
    it('No memberId return false', async () => {
      const request = buildRequest();

      const t = jwt.sign({ sub: undefined, challenge }, AUTH_TOKEN_JWT_SECRET);
      expect(await verifyMemberInAuthToken(t, request)).toBeFalsy();

      expect(request.member).toBeUndefined();
    });
    it('If member does not exist return false', async () => {
      const request = buildRequest();

      const t = jwt.sign({ sub: v4(), challenge }, AUTH_TOKEN_JWT_SECRET);

      expect(await verifyMemberInAuthToken(t, request)).toBeFalsy();

      expect(request.member).toBeUndefined();
    });
  });
});
