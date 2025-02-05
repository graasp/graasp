import { faker } from '@faker-js/faker';
import { beforeAll } from '@jest/globals';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { sign as jwtSign } from 'jsonwebtoken';

import { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
import { buildFile, seedFromJson } from '../../../test/mocks/seed';
import { resolveDependency } from '../../di/utils';
import { AppDataSource } from '../../plugins/datasource';
import { MailerService } from '../../plugins/mailer/service';
import { assertIsDefined } from '../../utils/assertions';
import { EMAIL_CHANGE_JWT_SECRET } from '../../utils/config';
import { Item } from '../item/entities/Item';
import {
  FILE_METADATA_MAX_PAGE_SIZE,
  FILE_METADATA_MIN_PAGE,
  FILE_METADATA_MIN_PAGE_SIZE,
} from './constants';
import { Member, assertIsMember } from './entities/member';

jest.mock('node-fetch');
const memberRawRepository = AppDataSource.getRepository(Member);

describe('Member Controller', () => {
  let app: FastifyInstance;
  let mockSendEmail: jest.SpyInstance;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });
  beforeEach(async () => {
    mockSendEmail = jest.spyOn(resolveDependency(MailerService), 'sendRaw');
  });
  afterEach(async () => {
    unmockAuthenticate();
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  describe('POST /members/current/email/change', () => {
    it('Unauthenticated', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      const response = await app.inject({
        method: 'POST',
        url: '/members/current/email/change',
        body: { email: faker.internet.email() },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Email didn't changed
      const rawMember = await memberRawRepository.findOneBy({ id: actor.id });
      expect(rawMember?.email).toEqual(actor.email);
    });

    it('No email provided', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: 'POST',
        url: '/members/current/email/change',
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Email didn't changed
      const rawMember = await memberRawRepository.findOneBy({ id: actor.id });
      expect(rawMember?.email).toEqual(actor.email);
    });
    it('Invalid email provided', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: 'POST',
        url: '/members/current/email/change',
        body: { email: 'abc' },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Email didn't changed
      const rawMember = await memberRawRepository.findOneBy({ id: actor.id });
      expect(rawMember?.email).toEqual(actor.email);
    });

    it('Already taken email', async () => {
      const email = 'randomemail@email.com';
      const {
        actor,
        members: [member],
      } = await seedFromJson({ members: [{ email }] });
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: 'POST',
        url: '/members/current/email/change',
        body: { email: member.email },
      });

      expect(response.statusCode).toBe(StatusCodes.CONFLICT);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Email didn't change
      const rawMember = await memberRawRepository.findOneBy({ id: actor.id });
      expect(rawMember?.email).toEqual(actor.email);
    });

    it('Change email', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const email = faker.internet.email();
      const response = await app.inject({
        method: 'POST',
        url: '/members/current/email/change',
        body: { email },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][1]).toBe(email);
      expect(mockSendEmail.mock.calls[0][2]).toContain('email/change?t=');
      // Email didn't change
      const rawMember = await memberRawRepository.findOneBy({ id: actor.id });
      expect(rawMember?.email).toEqual(actor.email);
    });
  });

  describe('PATCH /members/current/email/change', () => {
    let newEmail: string;
    beforeEach(async () => {
      newEmail = faker.internet.email().toLowerCase();
    });
    it('No JWT', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/members/current/email/change',
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      // Email didn't change
      const rawMember = await memberRawRepository.findOneBy({ id: actor.id });
      expect(rawMember?.email).toEqual(actor.email);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
    it('Invalid JWT', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);
      const token = jwtSign({ uuid: actor.id, oldEmail: actor.email, newEmail }, 'invalid');

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/members/current/email/change',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      // Email didn't changed
      const rawMember = await memberRawRepository.findOneBy({ id: actor.id });
      expect(rawMember?.email).toEqual(actor.email);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
    it('Already taken email', async () => {
      const {
        actor,
        members: [anotherMember],
      } = await seedFromJson({ members: [{ email: 'anotheremail@email.com' }] });
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);
      const token = jwtSign(
        { uuid: actor.id, oldEmail: actor.email, newEmail: anotherMember.email },
        EMAIL_CHANGE_JWT_SECRET,
      );

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/members/current/email/change',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(StatusCodes.CONFLICT);
      // Email didn't changed
      const rawMember = await memberRawRepository.findOneBy({ id: actor.id });
      expect(rawMember?.email).toEqual(actor.email);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
    it('Change email', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const token = jwtSign(
        { uuid: actor.id, oldEmail: actor.email, newEmail },
        EMAIL_CHANGE_JWT_SECRET,
      );

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/members/current/email/change',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      // Email changed
      const rawMember = await memberRawRepository.findOneBy({ id: actor.id });
      expect(rawMember?.email).toEqual(newEmail);
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
      expect(mockSendEmail.mock.calls[0][1]).toBe(actor.email);
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
  describe('GET /members/current/storage/files', () => {
    it('returns ok', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage/files',
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    it('returns bad request when page is lower than 1', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage/files',
        query: { page: FILE_METADATA_MIN_PAGE - 1 + '' },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('returns bad request when page size is lower than 1', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage/files',
        query: { pageSize: FILE_METADATA_MIN_PAGE_SIZE - 1 + '' },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('returns bad request when page size is greater than the maximum', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage/files',
        query: { pageSize: FILE_METADATA_MAX_PAGE_SIZE + 1 + '' },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('parent undefined when file is root', async () => {
      const { actor } = await seedFromJson({ items: [buildFile('actor')] });
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage/files',
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const resultDefault = await response.json();
      expect(resultDefault.totalCount).toBe(1);
      expect(resultDefault.pagination.page).toBe(1);
      expect(resultDefault.pagination.pageSize).toBe(10);
      expect(resultDefault.data.length).toBe(1);

      expect(resultDefault.data[0]).toHaveProperty('id');
      expect(resultDefault.data[0]).toHaveProperty('name');
      expect(resultDefault.data[0]).toHaveProperty('size');
      expect(resultDefault.data[0]).toHaveProperty('updatedAt');
      expect(resultDefault.data[0]).toHaveProperty('path');
      expect(resultDefault.data[0]).not.toHaveProperty('parent');
    });

    describe('pagination', () => {
      const totalFiles = 23;
      let rootFile: Item;

      beforeEach(async () => {
        // create members
        const {
          actor,
          members: [anotherMember],
        } = await seedFromJson({ members: [{}] });
        assertIsDefined(actor);
        assertIsMember(actor);

        // create items
        const { items } = await seedFromJson({
          actor: null,
          items: [
            { children: Array.from({ length: totalFiles }, () => buildFile({ id: actor.id })) },
            ...Array.from({ length: 5 }, () => buildFile({ id: anotherMember.id })),
          ],
        });
        rootFile = items[0];
        mockAuthenticate(actor);
      });

      it('default parameters when not specified', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/members/current/storage/files',
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultDefault = await response.json();
        expect(resultDefault.totalCount).toBe(totalFiles);
        expect(resultDefault.pagination.page).toBe(1);
        expect(resultDefault.pagination.pageSize).toBe(10);
        expect(resultDefault.data.length).toBe(10);

        expect(resultDefault.data[0]).toHaveProperty('id');
        expect(resultDefault.data[0]).toHaveProperty('name');
        expect(resultDefault.data[0]).toHaveProperty('size');
        expect(resultDefault.data[0]).toHaveProperty('updatedAt');
        expect(resultDefault.data[0]).toHaveProperty('path');
        expect(resultDefault.data[0]).toHaveProperty('parent');
        expect(resultDefault.data[0].parent.id).toBe(rootFile.id);
        expect(resultDefault.data[0].parent.name).toBe(rootFile.name);
      });
      it('paginate 10 by 10', async () => {
        // Check defaults
        const pageSize = 10;
        let page = 1;

        let response = await app.inject({
          method: HttpMethod.Get,
          url: '/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage1 = await response.json();
        expect(resultPage1.totalCount).toBe(totalFiles);
        expect(resultPage1.pagination.page).toBe(page);
        expect(resultPage1.pagination.pageSize).toBe(pageSize);
        expect(resultPage1.data.length).toBe(pageSize);

        page = 2;
        response = await app.inject({
          method: HttpMethod.Get,
          url: '/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage2 = await response.json();
        expect(resultPage2.totalCount).toBe(totalFiles);
        expect(resultPage2.pagination.page).toBe(page);
        expect(resultPage2.pagination.pageSize).toBe(pageSize);
        expect(resultPage2.data.length).toBe(pageSize);
        for (const data of resultPage2.data) {
          expect(resultPage1.data).not.toContainEqual(data);
        }

        page = 3;
        response = await app.inject({
          method: HttpMethod.Get,
          url: '/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage3 = await response.json();
        expect(resultPage3.totalCount).toBe(totalFiles);
        expect(resultPage3.pagination.page).toBe(page);
        expect(resultPage3.pagination.pageSize).toBe(pageSize);
        expect(resultPage3.data.length).toBe(3);
        for (const data of resultPage3.data) {
          expect(resultPage1.data).not.toContainEqual(data);
          expect(resultPage2.data).not.toContainEqual(data);
        }

        page = 4;
        response = await app.inject({
          method: HttpMethod.Get,
          url: '/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage4 = await response.json();
        expect(resultPage4.totalCount).toBe(totalFiles);
        expect(resultPage4.pagination.page).toBe(page);
        expect(resultPage4.pagination.pageSize).toBe(pageSize);
        expect(resultPage4.data.length).toBe(0);

        const completeData = [
          ...resultPage1.data,
          ...resultPage2.data,
          ...resultPage3.data,
          ...resultPage4.data,
        ];
        // Check order Desceding
        let lastSize = completeData[0].size;
        for (const data of completeData) {
          expect(data.size).toBeLessThanOrEqual(lastSize);
          lastSize = data.size;
        }
      });

      it('paginate 11 by 11', async () => {
        // Check defaults
        const pageSize = 11;
        let page = 1;

        let response = await app.inject({
          method: HttpMethod.Get,
          url: '/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage1 = await response.json();
        expect(resultPage1.totalCount).toBe(totalFiles);
        expect(resultPage1.pagination.page).toBe(page);
        expect(resultPage1.pagination.pageSize).toBe(pageSize);
        expect(resultPage1.data.length).toBe(pageSize);

        page = 2;
        response = await app.inject({
          method: HttpMethod.Get,
          url: '/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage2 = await response.json();
        expect(resultPage2.totalCount).toBe(totalFiles);
        expect(resultPage2.pagination.page).toBe(page);
        expect(resultPage2.pagination.pageSize).toBe(pageSize);
        expect(resultPage2.data.length).toBe(pageSize);
        for (const data of resultPage2.data) {
          expect(resultPage1.data).not.toContainEqual(data);
        }

        page = 3;
        response = await app.inject({
          method: HttpMethod.Get,
          url: '/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage3 = await response.json();
        expect(resultPage3.totalCount).toBe(totalFiles);
        expect(resultPage3.pagination.page).toBe(page);
        expect(resultPage3.pagination.pageSize).toBe(pageSize);
        expect(resultPage3.data.length).toBe(1);
        for (const data of resultPage3.data) {
          expect(resultPage1.data).not.toContainEqual(data);
          expect(resultPage2.data).not.toContainEqual(data);
        }

        page = 4;
        response = await app.inject({
          method: HttpMethod.Get,
          url: '/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage4 = await response.json();
        expect(resultPage4.totalCount).toBe(totalFiles);
        expect(resultPage4.pagination.page).toBe(page);
        expect(resultPage4.pagination.pageSize).toBe(pageSize);
        expect(resultPage4.data.length).toBe(0);

        const completeData = [
          ...resultPage1.data,
          ...resultPage2.data,
          ...resultPage3.data,
          ...resultPage4.data,
        ];
        // Check order Desceding
        let lastSize = completeData[0].size;
        for (const data of completeData) {
          expect(data.size).toBeLessThanOrEqual(lastSize);
          lastSize = data.size;
        }
      });
    });
  });

  describe('PATCH /members/:id', () => {
    it('username can not contain special characters', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const invalidName = '<divvy>%$^&';

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `members/${actor.id}`,
        body: { name: invalidName },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });
});
