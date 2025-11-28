import { StatusCodes } from 'http-status-codes';

import type { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, { mockAuthenticate } from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { assertIsDefined } from '../../../../utils/assertions';

export const getDateBeforeOrAfterNow = (dateDiff: number) => {
  const date = new Date(); // Today's date
  date.setDate(date.getDate() + dateDiff);
  return date.toISOString();
};

const GET_URL = '/api/members/actions';

describe('Get member actions', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(() => {
    app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /members/actions', () => {
    it('Cannot get actions when signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: GET_URL,
      });

      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    it('Get actions when user signed in for last month if no start and end date not exist', async () => {
      const { actor } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor' }],
            actions: [
              { account: 'actor', createdAt: getDateBeforeOrAfterNow(-1) },
              { account: 'actor', createdAt: getDateBeforeOrAfterNow(-1) },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: GET_URL,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json()).toHaveLength(2);
    });

    it('Get actions when user signed in specifing start and end dates that does not have any actions', async () => {
      const { actor } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor' }],
            actions: [
              { account: 'actor', createdAt: '2015-03-25T12:02:29.210Z' },
              { account: 'actor', createdAt: '2015-03-25T12:02:29.210Z' },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${GET_URL}?startDate=${getDateBeforeOrAfterNow(-2)}&endDate=${getDateBeforeOrAfterNow(
          -1,
        )}`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json()).toHaveLength(0);
    });
  });
});
