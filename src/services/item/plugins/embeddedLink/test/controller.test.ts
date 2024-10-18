import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';
import fetch, { Response } from 'node-fetch';

import { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { FETCH_RESULT, METADATA } from './fixtures';

jest.mock('node-fetch');

const URL = '/items/embedded-links/metadata';
const QUERY_PARAM = 'link';

describe('Tests Embedded Link Controller', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('GET /items/embedded-links/metadata', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const response = await app.inject({
        method: HttpMethod.Get,
        url: URL,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('Throws if link parameter is not set', async () => {
      ({ app } = await build());

      const response = await app.inject({
        method: HttpMethod.Get,
        url: URL,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Throws if URL is not valid', async () => {
      ({ app } = await build());

      const invalidUrl = encodeURI('https://invalid');
      const url = `${URL}?${QUERY_PARAM}=${invalidUrl}`;

      const response = await app.inject({
        method: HttpMethod.Get,
        url,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('Returns 200 Ok when a valid URL is set', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
        return { json: async () => FETCH_RESULT } as Response;
      });

      ({ app } = await build());

      const validUrl = encodeURI('https://valid-url.ch:5050/myPage');
      const url = `${URL}?${QUERY_PARAM}=${validUrl}`;

      const response = await app.inject({
        method: HttpMethod.Get,
        url,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
    });

    it('Returns 200 Ok when a valid URL without html', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
        return {
          json: async () => ({
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
          }),
        } as Response;
      });

      ({ app } = await build());

      const validUrl = encodeURI('https://valid-url.ch:5050/myPage');
      const url = `${URL}?${QUERY_PARAM}=${validUrl}`;

      const response = await app.inject({
        method: HttpMethod.Get,
        url,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
    });
  });
});
