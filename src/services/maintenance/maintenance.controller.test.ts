import { add, sub } from 'date-fns';
import { StatusCodes } from 'http-status-codes';

import type { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase, unmockAuthenticate } from '../../../test/app';
import { db } from '../../drizzle/db';
import { maintenanceTable } from '../../drizzle/schema';

describe('Maintenance Controller Tests', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    await db.delete(maintenanceTable);
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('GET maintenance/next', () => {
    it('Get maintenance', async () => {
      // save maintenance
      const value = {
        startAt: add(new Date(), { months: 1 }).toISOString(),
        endAt: add(new Date(), { months: 2 }).toISOString(),
        slug: 'my-slug',
      };
      await db.insert(maintenanceTable).values(value);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/maintenance/next`,
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json().slug).toEqual(value.slug);
    });
    it('Get empty response for no maintenance', async () => {
      // save maintenance before now
      const value = {
        startAt: sub(new Date(), { months: 1 }).toISOString(),
        endAt: sub(new Date(), { months: 2 }).toISOString(),
        slug: 'my-slug',
      };
      await db.insert(maintenanceTable).values(value);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/maintenance/next`,
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json()).toBeNull();
    });
  });
});
