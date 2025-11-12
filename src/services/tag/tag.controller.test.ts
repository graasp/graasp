import { faker } from '@faker-js/faker';
import { StatusCodes } from 'http-status-codes';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, TagCategory } from '@graasp/sdk';

import build, { clearDatabase, unmockAuthenticate } from '../../../test/app';
import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';

describe('Tag Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('GET /tags', () => {
    describe('Schema validation', () => {
      it('Throw for undefined search', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/tags`,
          query: { category: TagCategory.Discipline },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Throw for empty search', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/api/tags`,
          query: { search: '', category: TagCategory.Discipline },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });

    it('Return count', async () => {
      const commonString = faker.word.sample();
      const { tags } = await seedFromJson({
        items: [
          {
            tags: [
              { name: commonString + faker.number.bigInt(), category: TagCategory.Discipline },
              { name: commonString + faker.number.bigInt(), category: TagCategory.Discipline },
              { name: commonString + faker.number.bigInt(), category: TagCategory.Level },
            ],
          },
        ],
      });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/tags`,
        query: { search: commonString, category: TagCategory.Discipline },
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const data = response.json();
      expect(data).toHaveLength(2);
      for (const d of data) {
        expect(tags.map((t) => t.name)).toContain(d.name);
        expect(d.category).toEqual(TagCategory.Discipline);
        expect(d.count).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
