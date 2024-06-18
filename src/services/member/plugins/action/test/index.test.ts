import { StatusCodes } from 'http-status-codes';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app.js';
import { getDateBeforeOrAfterNow, saveActionsWithItems } from './utils.js';

// mock datasource
jest.mock('../../../../../plugins/datasource');
const GET_URL = '/members/actions';

describe('Get member actions', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('GET /members/actions', () => {
    it('Cannot get actions when signed out', async () => {
      ({ app, actor } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.Get,
        url: GET_URL,
      });

      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    it('Get actions when user signed in for last month if no satrt and end date not exist', async () => {
      ({ app, actor } = await build());

      await saveActionsWithItems(actor);
      const response = await app.inject({
        method: HttpMethod.Get,
        url: GET_URL,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json()).toHaveLength(2);
    });

    it('Get actions when user signed in specifing start and end dates that does not have any actions', async () => {
      ({ app, actor } = await build());
      await saveActionsWithItems(actor);
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
