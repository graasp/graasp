import { faker } from '@faker-js/faker';
import { beforeAll } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';
import { sign as jwtSign } from 'jsonwebtoken';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
import { resolveDependency } from '../../di/utils';
import { AppDataSource } from '../../plugins/datasource';
import { MailerService } from '../../plugins/mailer/service';
import { ACCOUNT_HOST, EMAIL_CHANGE_JWT_SECRET } from '../../utils/config';
import { Item } from '../item/entities/Item';
import { ItemTestUtils } from '../item/test/fixtures/items';
import {
  FILE_METADATA_MAX_PAGE_SIZE,
  FILE_METADATA_MIN_PAGE,
  FILE_METADATA_MIN_PAGE_SIZE,
} from './constants';
import { Actor, Member } from './entities/member';
import { saveMember } from './test/fixtures/members';

jest.mock('node-fetch');
const memberRawRepository = AppDataSource.getRepository(Member);
const testUtils = new ItemTestUtils();

async function saveFile(member: Member, parentItem?: Item) {
  return await testUtils.saveItemAndMembership({
    item: {
      creator: member,
      type: ItemType.S3_FILE,
      extra: {
        [ItemType.S3_FILE]: {
          size: faker.number.int({ min: 1, max: 1000 }),
          content: 'content',
          mimetype: 'image/png',
          name: faker.system.fileName(),
          path: faker.system.filePath(),
        },
      },
    },
    member: member,
    parentItem,
  });
}

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
    mockSendEmail = jest.spyOn(resolveDependency(MailerService), 'sendEmail');
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
  describe('GET /members/current/storage/files', () => {
    it('returns ok', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage/files',
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    it('returns bad request when page is lower than 1', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage/files',
        query: { page: FILE_METADATA_MIN_PAGE - 1 + '' },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('returns bad request when page size is lower than 1', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage/files',
        query: { pageSize: FILE_METADATA_MIN_PAGE_SIZE - 1 + '' },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('returns bad request when page size is greater than the maximum', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage/files',
        query: { pageSize: FILE_METADATA_MAX_PAGE_SIZE + 1 + '' },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('parent undefined when file is root', async () => {
      await saveFile(member);

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
        const anotherMember = await saveMember();
        rootFile = (await saveFile(anotherMember)).item;

        for (let i = 0; i < totalFiles; i++) {
          await saveFile(member, rootFile);
        }

        for (let i = 0; i < 5; i++) {
          await saveFile(anotherMember);
        }
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
        for (let i = 0; i < resultPage2.data.length; i++) {
          expect(resultPage1.data).not.toContainEqual(resultPage2.data[i]);
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
        for (let i = 0; i < resultPage3.data.length; i++) {
          expect(resultPage1.data).not.toContainEqual(resultPage3.data[i]);
          expect(resultPage2.data).not.toContainEqual(resultPage3.data[i]);
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
        for (let i = 0; i < resultPage2.data.length; i++) {
          expect(resultPage1.data).not.toContainEqual(resultPage2.data[i]);
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
        for (let i = 0; i < resultPage3.data.length; i++) {
          expect(resultPage1.data).not.toContainEqual(resultPage3.data[i]);
          expect(resultPage2.data).not.toContainEqual(resultPage3.data[i]);
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
      });
    });
  });
});
