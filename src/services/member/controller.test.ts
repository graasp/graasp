import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import { sign as jwtSign } from 'jsonwebtoken';

import { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
import { AppDataSource } from '../../plugins/datasource';
import { ACCOUNT_HOST, EMAIL_CHANGE_JWT_SECRET } from '../../utils/config';
import { Actor, Member } from './entities/member';
import { saveMember } from './test/fixtures/members';

jest.mock('node-fetch');
jest.mock('../../plugins/datasource');
const memberRawRepository = AppDataSource.getRepository(Member);

describe('Member Controller', () => {
  let member: Member;
  let app: FastifyInstance;
  let mockSendEmail: jest.SpyInstance;
  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });
  beforeEach(async () => {
    member = await saveMember();
    mockAuthenticate(member as Actor);
    mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');
  });
  afterEach(async () => {
    await clearDatabase(app.db);
    jest.clearAllMocks();
  });
  afterAll(async () => {
    app.close();
  });

  describe('POST /members/current/email/change', () => {
    it('Unauthenticated', async () => {
      unmockAuthenticate();
      const response = await app.inject({
        method: 'POST',
        url: '/members/current/email/change',
        body: { email: faker.internet.email() },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Email didn't changed
      const rawMember = await memberRawRepository.findOneBy({ id: member.id });
      expect(rawMember?.email).toEqual(member.email);
    });

    it('No email provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/members/current/email/change',
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Email didn't changed
      const rawMember = await memberRawRepository.findOneBy({ id: member.id });
      expect(rawMember?.email).toEqual(member.email);
    });
    it('Invalid email provided', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/members/current/email/change',
        body: { email: 'abc' },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Email didn't changed
      const rawMember = await memberRawRepository.findOneBy({ id: member.id });
      expect(rawMember?.email).toEqual(member.email);
    });

    it('Already taken email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/members/current/email/change',
        body: { email: member.email },
      });
      expect(response.statusCode).toBe(StatusCodes.CONFLICT);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Email didn't change
      const rawMember = await memberRawRepository.findOneBy({ id: member.id });
      expect(rawMember?.email).toEqual(member.email);
    });

    it('Change email', async () => {
      const email = faker.internet.email();
      const response = await app.inject({
        method: 'POST',
        url: '/members/current/email/change',
        body: { email },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][1]).toBe(email);
      expect(mockSendEmail.mock.calls[0][2]).toMatch(
        new RegExp(`^${ACCOUNT_HOST.url}email/change\\?t=.*$`),
      );
      // Email didn't change
      const rawMember = await memberRawRepository.findOneBy({ id: member.id });
      expect(rawMember?.email).toEqual(member.email);
    });
  });

  describe('PATCH /members/current/email/change', () => {
    let newEmail: string;
    beforeEach(async () => {
      newEmail = faker.internet.email().toLowerCase();
    });
    it('No JWT', async () => {
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/members/current/email/change',
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      // Email didn't change
      const rawMember = await memberRawRepository.findOneBy({ id: member.id });
      expect(rawMember?.email).toEqual(member.email);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
    it('Invalid JWT', async () => {
      const token = jwtSign({ uuid: member.id, oldEmail: member.email, newEmail }, 'invalid');

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/members/current/email/change',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      // Email didn't changed
      const rawMember = await memberRawRepository.findOneBy({ id: member.id });
      expect(rawMember?.email).toEqual(member.email);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
    it('Already taken email', async () => {
      const anotherMember = await saveMember();
      const token = jwtSign(
        { uuid: member.id, oldEmail: member.email, newEmail: anotherMember.email },
        EMAIL_CHANGE_JWT_SECRET,
      );

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/members/current/email/change',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(StatusCodes.CONFLICT);
      // Email didn't changed
      const rawMember = await memberRawRepository.findOneBy({ id: member.id });
      expect(rawMember?.email).toEqual(member.email);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
    it('Change email', async () => {
      const token = jwtSign(
        { uuid: member.id, oldEmail: member.email, newEmail },
        EMAIL_CHANGE_JWT_SECRET,
      );

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/members/current/email/change',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      // Email changed
      const rawMember = await memberRawRepository.findOneBy({ id: member.id });
      expect(rawMember?.email).toEqual(newEmail);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][1]).toBe(member.email);
      mockSendEmail.mockClear();

      // JWT is invalidated
      const response2 = await app.inject({
        method: HttpMethod.Patch,
        url: '/members/current/email/change',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response2.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });
});
