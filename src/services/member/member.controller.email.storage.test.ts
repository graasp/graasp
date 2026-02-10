import { faker } from '@faker-js/faker';
import { beforeAll } from '@jest/globals';
import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { sign as jwtSign } from 'jsonwebtoken';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { type FileItemExtra, HttpMethod } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
import { buildFile, seedFromJson } from '../../../test/mocks/seed';
import { EMAIL_CHANGE_JWT_SECRET } from '../../config/secrets';
import { db } from '../../drizzle/db';
import { accountsTable } from '../../drizzle/schema';
import { MailerService } from '../../plugins/mailer/mailer.service';
import { assertIsDefined } from '../../utils/assertions';
import { assertIsMember } from '../authentication';
import type { ItemRaw } from '../item/item';
import {
  FILE_METADATA_MAX_PAGE_SIZE,
  FILE_METADATA_MIN_PAGE,
  FILE_METADATA_MIN_PAGE_SIZE,
} from './constants';

jest.mock('node-fetch');

describe('Member Storage Controller', () => {
  let app: FastifyInstance;
  let mockSendEmail: jest.SpyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });
  beforeEach(async () => {
    mockSendEmail = jest.spyOn(MailerService.prototype, 'sendRaw');
  });
  afterEach(async () => {
    unmockAuthenticate();
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  describe('POST /members/current/email/change', () => {
    it('Unauthenticated', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      const response = await app.inject({
        method: 'POST',
        url: '/api/members/current/email/change',
        body: { email: faker.internet.email() },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Email didn't changed
      const rawMember = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, actor.id),
      });
      expect(rawMember?.email).toEqual(actor.email);
    });

    it('No email provided', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: 'POST',
        url: '/api/members/current/email/change',
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Email didn't changed
      const rawMember = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, actor.id),
      });
      expect(rawMember?.email).toEqual(actor.email);
    });
    it('Invalid email provided', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: 'POST',
        url: '/api/members/current/email/change',
        body: { email: 'abc' },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Email didn't changed
      const rawMember = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, actor.id),
      });
      expect(rawMember?.email).toEqual(actor.email);
    });

    it('Already taken email', async () => {
      const email = faker.internet.email().toLowerCase();
      const {
        actor,
        members: [member],
      } = await seedFromJson({ members: [{ email }] });
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: 'POST',
        url: '/api/members/current/email/change',
        body: { email: member.email },
      });

      expect(response.statusCode).toBe(StatusCodes.CONFLICT);
      expect(mockSendEmail).not.toHaveBeenCalled();
      // Email didn't change
      const rawMember = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, actor.id),
      });
      expect(rawMember?.email).toEqual(actor.email);
    });

    it('Change email', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const email = faker.internet.email();
      const response = await app.inject({
        method: 'POST',
        url: '/api/members/current/email/change',
        body: { email },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      await waitForExpect(() => {
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
        expect(mockSendEmail.mock.calls[0][1]).toBe(email.toLowerCase());
        expect(mockSendEmail.mock.calls[0][2]).toContain('email/change?t=');
      });

      // Email didn't change
      const rawMember = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, actor.id),
      });
      expect(rawMember?.email).toEqual(actor.email);
    });
  });

  describe('PATCH /members/current/email/change', () => {
    it('No JWT', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/api/members/current/email/change',
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      // Email didn't change
      const rawMember = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, actor.id),
      });
      expect(rawMember?.email).toEqual(actor.email);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
    it('Invalid JWT', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);
      const token = jwtSign(
        { uuid: actor.id, oldEmail: actor.email, newEmail: faker.internet.email().toLowerCase() },
        'invalid',
      );

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/api/members/current/email/change',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      // Email didn't changed
      const rawMember = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, actor.id),
      });
      expect(rawMember?.email).toEqual(actor.email);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
    it('Already taken email', async () => {
      const {
        actor,
        members: [anotherMember],
      } = await seedFromJson({ members: [{}] });
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);
      const token = jwtSign(
        { uuid: actor.id, oldEmail: actor.email, newEmail: anotherMember.email },
        EMAIL_CHANGE_JWT_SECRET,
      );

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/api/members/current/email/change',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(StatusCodes.CONFLICT);
      // Email didn't changed
      const rawMember = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, actor.id),
      });
      expect(rawMember?.email).toEqual(actor.email);
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
    it('Change email', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const newEmail = faker.internet.email().toLowerCase();
      const token = jwtSign(
        { uuid: actor.id, oldEmail: actor.email, newEmail },
        EMAIL_CHANGE_JWT_SECRET,
      );

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/api/members/current/email/change',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      // Email changed
      const rawMember = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, actor.id),
      });
      expect(rawMember?.email).toEqual(newEmail);

      // send confirmation email to old email
      await waitForExpect(() => {
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
        // send to old mail
        expect(mockSendEmail.mock.calls[0][1]).toBe(actor.email);
      });

      // JWT is invalidated
      const response2 = await app.inject({
        method: HttpMethod.Patch,
        url: '/api/members/current/email/change',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response2.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      // mock send email only sent once, before
      expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
    // regression test for issue #1939
    it('Change email and store as lowercase', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      // specifically use an uppercase email
      const newEmail = faker.internet.email().toUpperCase();
      const token = jwtSign(
        { uuid: actor.id, oldEmail: actor.email, newEmail },
        EMAIL_CHANGE_JWT_SECRET,
      );

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: '/api/members/current/email/change',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      // Email changed
      const rawMember = await db.query.accountsTable.findFirst({
        where: eq(accountsTable.id, actor.id),
      });
      expect(rawMember?.email).toEqual(newEmail.toLowerCase());
    });
  });
  describe('GET /members/current/storage/files', () => {
    it('returns ok', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/api/members/current/storage/files',
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    it('returns bad request when page is lower than 1', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/api/members/current/storage/files',
        query: { page: FILE_METADATA_MIN_PAGE - 1 + '' },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('returns bad request when page size is lower than 1', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/api/members/current/storage/files',
        query: { pageSize: FILE_METADATA_MIN_PAGE_SIZE - 1 + '' },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('returns bad request when page size is greater than the maximum', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/api/members/current/storage/files',
        query: { pageSize: FILE_METADATA_MAX_PAGE_SIZE + 1 + '' },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('parent undefined when file is root', async () => {
      const {
        actor,
        items: [withoutParent, parent, child],
      } = await seedFromJson({
        items: [
          buildFile('actor', { size: 1000 }),
          { children: [buildFile('actor', { size: 100 })] },
        ],
      });
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/api/members/current/storage/files',
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      const resultDefault = await response.json();
      expect(resultDefault.pagination.page).toBe(1);
      expect(resultDefault.pagination.pageSize).toBe(10);
      expect(resultDefault.data.length).toBe(2);

      // root item
      expect(resultDefault.data[0].id).toEqual(withoutParent.id);
      expect(resultDefault.data[0].name).toEqual(withoutParent.name);
      expect(resultDefault.data[0]).toHaveProperty('size');
      expect(resultDefault.data[0]).toHaveProperty('updatedAt');
      expect(resultDefault.data[0].path).toEqual((withoutParent.extra as FileItemExtra).file.path);
      expect(resultDefault.data[0]).not.toHaveProperty('parent');

      // child item
      expect(resultDefault.data[1].id).toEqual(child.id);
      expect(resultDefault.data[1].name).toEqual(child.name);
      expect(resultDefault.data[1]).toHaveProperty('size');
      expect(resultDefault.data[1]).toHaveProperty('updatedAt');
      expect(resultDefault.data[1].path).toEqual((child.extra as FileItemExtra).file.path);
      expect(resultDefault.data[1].parent.id).toEqual(parent.id);
    });

    describe('pagination', () => {
      const totalFiles = 23;
      let rootFile: ItemRaw;

      beforeEach(async () => {
        const { items, actor } = await seedFromJson({
          items: [
            { children: Array.from({ length: totalFiles }, () => buildFile('actor')) },
            ...Array.from({ length: 5 }, () => buildFile({ name: 'another-member' })),
          ],
        });
        rootFile = items[0];
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);
      });

      it('default parameters when not specified', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/members/current/storage/files',
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultDefault = await response.json();
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
          url: '/api/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage1 = await response.json();
        expect(resultPage1.pagination.page).toBe(page);
        expect(resultPage1.pagination.pageSize).toBe(pageSize);
        expect(resultPage1.data.length).toBe(pageSize);

        page = 2;
        response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage2 = await response.json();
        expect(resultPage2.pagination.page).toBe(page);
        expect(resultPage2.pagination.pageSize).toBe(pageSize);
        expect(resultPage2.data.length).toBe(pageSize);
        for (const data of resultPage2.data) {
          expect(resultPage1.data).not.toContainEqual(data);
        }

        page = 3;
        response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage3 = await response.json();
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
          url: '/api/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage4 = await response.json();
        expect(resultPage4.pagination.page).toBe(page);
        expect(resultPage4.pagination.pageSize).toBe(pageSize);
        expect(resultPage4.data.length).toBe(0);

        const completeData = [
          ...resultPage1.data,
          ...resultPage2.data,
          ...resultPage3.data,
          ...resultPage4.data,
        ];
        // Check order Descending
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
          url: '/api/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage1 = await response.json();
        expect(resultPage1.pagination.page).toBe(page);
        expect(resultPage1.pagination.pageSize).toBe(pageSize);
        expect(resultPage1.data.length).toBe(pageSize);

        page = 2;
        response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage2 = await response.json();
        expect(resultPage2.pagination.page).toBe(page);
        expect(resultPage2.pagination.pageSize).toBe(pageSize);
        expect(resultPage2.data.length).toBe(pageSize);
        for (const data of resultPage2.data) {
          expect(resultPage1.data).not.toContainEqual(data);
        }

        page = 3;
        response = await app.inject({
          method: HttpMethod.Get,
          url: '/api/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage3 = await response.json();
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
          url: '/api/members/current/storage/files',
          query: { page: page + '', pageSize: pageSize + '' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const resultPage4 = await response.json();
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
});
