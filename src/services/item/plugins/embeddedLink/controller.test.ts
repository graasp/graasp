import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import nock from 'nock';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, MemberFactory } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { AppDataSource } from '../../../../plugins/datasource';
import { EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN } from '../../../../utils/config';
import { Guest } from '../../../itemLogin/entities/guest';
import { saveMember } from '../../../member/test/fixtures/members';
import { ItemTestUtils } from '../../test/fixtures/items';
import { FETCH_RESULT, METADATA } from './test/fixtures';

const rawGuestRepository = AppDataSource.getRepository(Guest);
const itemTestUtils = new ItemTestUtils();
const MOCK_URL = 'https://url.com';

const iframelyResult = {
  meta: {
    title: 'title-patch',
    description: 'description-patch',
  },
  html: 'html-patch',
  links: [
    { rel: ['icon'], href: 'icon' },
    { rel: ['thumbnail'], href: 'thumbnail' },
  ],
  // used for test
  icons: ['icon'],
  thumbnails: ['thumbnail'],
};

describe('Tests Embedded Link Controller', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });
  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });
  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  describe('GET /items/embedded-links/metadata', () => {
    const URL = '/items/embedded-links/metadata';

    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: URL,
        query: { link: MOCK_URL },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('Throws if link parameter is not set', async () => {
      const actor = await saveMember(MemberFactory({ isValidated: false }));
      mockAuthenticate(actor);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: URL,
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Throws if URL is not valid', async () => {
      const actor = await saveMember(MemberFactory({ isValidated: false }));
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: URL,
        query: { link: encodeURI('https://invalid') },
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Returns 200 Ok when a valid URL is set', async () => {
      const validUrl = encodeURI('https://valid-url.ch:5050/myPage');

      nock(EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN)
        .get(`/iframely`)
        .query({ uri: validUrl })
        .reply(200, FETCH_RESULT);

      const actor = await saveMember(MemberFactory({ isValidated: false }));
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: URL,
        query: { link: validUrl },
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
    });

    it('Returns 200 Ok when a valid URL without html', async () => {
      const validUrl = encodeURI('https://valid-url.ch:5050/myPage');

      nock(EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN)
        .get(`/iframely`)
        .query({ uri: validUrl })
        .reply(200, {
          meta: METADATA,
          links: [
            {
              rel: ['thumbnail'],
              href: faker.internet.url(),
            },
            {
              rel: ['icon'],
              href: faker.internet.url(),
            },
          ],
        });

      const actor = await saveMember();
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: URL,
        query: { link: validUrl },
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
    });
  });

  describe('POST /items/embedded-links', () => {
    describe('Schema validation', () => {
      it('Throws if name is undefined', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/embedded-links',
          payload: { url: MOCK_URL },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Throws if name is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/embedded-links',
          payload: { name: '', url: MOCK_URL },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Throws if url is undefined', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/embedded-links',
          payload: { name: 'n' },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Throws if url is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/embedded-links',
          payload: { name: 'name', url: 'url' },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
    it('Throws if actor is guest', async () => {
      const actor = await rawGuestRepository.save({ name: 'guest' });
      mockAuthenticate(actor);
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/embedded-links`,
        payload: { name: 'name', url: MOCK_URL },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('Throws if actor is not validated', async () => {
      const actor = await saveMember(MemberFactory({ isValidated: false }));
      mockAuthenticate(actor);
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/embedded-links`,
        payload: { name: 'name', url: MOCK_URL },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/embedded-links',
        payload: { name: 'name', url: MOCK_URL },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Do not fail if iframely is unresponsive', async () => {
      const actor = await saveMember();
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/embedded-links',
        payload: { name: 'name', url: MOCK_URL },
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    describe('mock iframely', () => {
      beforeEach(() => {
        nock(EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN).get(`/iframely`).reply(200, iframelyResult);
      });
      it('Create link', async () => {
        const actor = await saveMember();
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/embedded-links',
          payload: { name: 'name', url: MOCK_URL },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Create link with parameters', async () => {
        const actor = await saveMember();
        mockAuthenticate(actor);

        const { item: parentItem } = await itemTestUtils.saveItemAndMembership({ member: actor });
        const { item: previousItem } = await itemTestUtils.saveItemAndMembership({
          member: actor,
          parentItem,
        });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/embedded-links',
          query: {
            parentId: parentItem.id,
            previousItemId: previousItem.id,
          },
          payload: {
            geolocation: { lat: 1, lng: 1 },
            name: 'name',
            url: MOCK_URL,
            showLinkIframe: true,
            showLinkButton: true,
          },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });

  describe('PATCH /items/embedded-links/:id', () => {
    describe('Schema validation', () => {
      it('Throws if name is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/embedded-links/${v4()}`,
          payload: { name: '' },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Throws if url is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/embedded-links/${v4()}`,
          payload: { url: 'url' },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Throws if id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/embedded-links/invalid`,
          payload: { url: 'url' },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/embedded-links/${v4()}`,
        payload: { name: 'name', url: MOCK_URL },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('Throws if actor is guest', async () => {
      const actor = await rawGuestRepository.save({ name: 'guest' });
      mockAuthenticate(actor);
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/embedded-links/${v4()}`,
        payload: { name: 'name', url: MOCK_URL },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('Throws if actor is not validated', async () => {
      const actor = await saveMember(MemberFactory({ isValidated: false }));
      mockAuthenticate(actor);
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/embedded-links/${v4()}`,
        payload: { name: 'name', url: MOCK_URL },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
    it('Do not fail if iframely is unresponsive', async () => {
      const actor = await saveMember();
      mockAuthenticate(actor);

      const { item } = await itemTestUtils.saveItemAndMembership({
        item: { type: ItemType.LINK },
        member: actor,
      });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/embedded-links/${item.id}`,
        payload: { name: 'name', url: MOCK_URL },
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    describe('mock iframely', () => {
      beforeEach(() => {
        nock(EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN).get(`/iframely`).reply(200, iframelyResult);
      });
      it('Update link', async () => {
        const actor = await saveMember();
        mockAuthenticate(actor);
        const { item } = await itemTestUtils.saveItemAndMembership({
          item: { type: ItemType.LINK },
          member: actor,
        });

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/embedded-links/${item.id}`,
          payload: { name: 'name', url: MOCK_URL },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
      });
      it('Update link with other parameters', async () => {
        const actor = await saveMember();
        mockAuthenticate(actor);
        const { item } = await itemTestUtils.saveItemAndMembership({
          item: { type: ItemType.LINK },
          member: actor,
        });

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/embedded-links/${item.id}`,
          payload: {
            name: 'name',
            showLinkIframe: true,
            showLinkButton: true,
            settings: {
              isCollapsible: true,
            },
          },
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });
});
