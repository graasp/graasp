import { StatusCodes } from 'http-status-codes';

import { Context, HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import {
  saveItemAndMembership,
  saveMembership,
} from '../../../../itemMembership/test/fixtures/memberships';
import { MEMBERS, saveMembers } from '../../../../member/test/fixtures/members';
import { ItemActionType } from '../utils';
import { saveActions } from './fixtures/actions';

// mock datasource
jest.mock('../../../../../plugins/datasource');

describe('Aggregate Tests', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('GET /:id/actions/aggregation', () => {
    describe('Authorization', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Unauthorized if the user does not have any permission', async () => {
        const members = await saveMembers(MEMBERS);
        const { item } = await saveItemAndMembership({ member: members[0] });

        const parameters = {
          requestedSampleSize: 5000,
          view: Context.Builder,
          countGroupBy: ['user', 'createdDay', 'actionType'],
          aggregateFunction: 'avg',
          aggregateMetric: 'actionCount',
          aggregateBy: ['createdDay', 'actionType'],
        };
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `items/${item.id}/actions/aggregation`,
          query: parameters,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });

      it('Succeed if the user has READ permission', async () => {
        const members = await saveMembers(MEMBERS);
        const { item } = await saveItemAndMembership({ member: members[0] });
        saveMembership({ item, member: actor, permission: PermissionLevel.Read });

        const parameters = {
          requestedSampleSize: 5000,
          view: Context.Builder,
          countGroupBy: ['user', 'createdDay', 'actionType'],
          aggregateFunction: 'avg',
          aggregateMetric: 'actionCount',
          aggregateBy: ['createdDay', 'actionType'],
        };
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `items/${item.id}/actions/aggregation`,
          query: parameters,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });

    describe('Functionality', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Successfully get the average action count aggregated by the createdDay and the actionType', async () => {
        const members = await saveMembers(MEMBERS);
        const { item } = await saveItemAndMembership({ member: actor });
        await saveActions(item, members);

        const parameters = {
          requestedSampleSize: 5000,
          view: Context.Builder,
          countGroupBy: ['user', 'createdDay', 'actionType'],
          aggregateFunction: 'avg',
          aggregateMetric: 'actionCount',
          aggregateBy: ['createdDay', 'actionType'],
        };
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `items/${item.id}/actions/aggregation`,
          query: parameters,
        });

        expect(response.json()).toHaveProperty([0, 'actionType'], ItemActionType.Create);
        expect(response.json()).toHaveProperty([0, 'aggregateResult']);
        expect(parseFloat(response.json()[0]['aggregateResult'])).toBeCloseTo(1);
        expect(response.json()).toHaveProperty([0, 'createdDay'], '2023-05-20T00:00:00.000Z');

        expect(response.json()).toHaveProperty([1, 'actionType'], ItemActionType.Update);
        expect(response.json()).toHaveProperty([1, 'aggregateResult']);
        expect(parseFloat(response.json()[1]['aggregateResult'])).toBeCloseTo(1.33);
        expect(response.json()).toHaveProperty([1, 'createdDay'], '2023-05-21T00:00:00.000Z');
      });

      it('Successfully get the number of active user by day', async () => {
        const members = await saveMembers(MEMBERS);
        const { item } = await saveItemAndMembership({ member: actor });
        await saveActions(item, members);

        const parameters = {
          requestedSampleSize: 5000,
          view: Context.Builder,
          countGroupBy: ['user', 'createdDay'],
          aggregateFunction: 'count',
          aggregateMetric: 'actionCount',
          aggregateBy: ['createdDay'],
        };
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `items/${item.id}/actions/aggregation`,
          query: parameters,
        });

        expect(response.json()).toHaveProperty([0, 'aggregateResult']);
        expect(parseFloat(response.json()[0]['aggregateResult'])).toBeCloseTo(1);
        expect(response.json()).toHaveProperty([0, 'createdDay'], '2023-05-20T00:00:00.000Z');

        expect(response.json()).toHaveProperty([1, 'aggregateResult']);
        expect(parseFloat(response.json()[1]['aggregateResult'])).toBeCloseTo(3);
        expect(response.json()).toHaveProperty([1, 'createdDay'], '2023-05-21T00:00:00.000Z');
      });

      it('Successfully get the total action count aggregated by the actionType', async () => {
        const members = await saveMembers(MEMBERS);
        const { item } = await saveItemAndMembership({ member: actor });
        await saveActions(item, members);

        const parameters = {
          requestedSampleSize: 5000,
          view: Context.Builder,
          countGroupBy: ['actionType'],
          aggregateFunction: 'sum',
          aggregateMetric: 'actionCount',
          aggregateBy: ['actionType'],
        };
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `items/${item.id}/actions/aggregation`,
          query: parameters,
        });

        expect(response.json()).toHaveProperty([0, 'actionType'], ItemActionType.Create);
        expect(response.json()).toHaveProperty([0, 'aggregateResult']);
        expect(parseFloat(response.json()[0]['aggregateResult'])).toBeCloseTo(1);

        expect(response.json()).toHaveProperty([1, 'actionType'], ItemActionType.Update);
        expect(response.json()).toHaveProperty([1, 'aggregateResult']);
        expect(parseFloat(response.json()[1]['aggregateResult'])).toBeCloseTo(4);
      });

      it('Successfully get the total action count aggregated by time of day', async () => {
        const members = await saveMembers(MEMBERS);
        const { item } = await saveItemAndMembership({ member: actor });
        await saveActions(item, members);

        const parameters = {
          requestedSampleSize: 5000,
          view: Context.Builder,
          countGroupBy: ['createdTimeOfDay'],
          aggregateFunction: 'sum',
          aggregateMetric: 'actionCount',
          aggregateBy: ['createdTimeOfDay'],
        };
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `items/${item.id}/actions/aggregation`,
          query: parameters,
        });

        expect(response.json()).toHaveProperty([0, 'createdTimeOfDay'], '3');
        expect(response.json()).toHaveProperty([0, 'aggregateResult']);
        expect(parseFloat(response.json()[0]['aggregateResult'])).toBeCloseTo(1);

        expect(response.json()).toHaveProperty([1, 'createdTimeOfDay'], '8');
        expect(response.json()).toHaveProperty([1, 'aggregateResult']);
        expect(parseFloat(response.json()[1]['aggregateResult'])).toBeCloseTo(4);
      });

      it('Bad request if query parameters are invalid (aggregated by user)', async () => {
        const members = await saveMembers(MEMBERS);
        const { item } = await saveItemAndMembership({ member: actor });
        await saveActions(item, members);

        const parameters = {
          requestedSampleSize: 5000,
          view: Context.Builder,
          countGroupBy: ['user', 'createdDay', 'actionType'],
          aggregateFunction: 'avg',
          aggregateMetric: 'actionCount',
          aggregateBy: ['user', 'actionType'],
        };
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `items/${item.id}/actions/aggregation`,
          query: parameters,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if query parameters are invalid (parameters mismatch)', async () => {
        const members = await saveMembers(MEMBERS);
        const { item } = await saveItemAndMembership({ member: actor });
        await saveActions(item, members);

        const parameters = {
          requestedSampleSize: 5000,
          view: Context.Builder,
          countGroupBy: ['user', 'createdDay'],
          aggregateFunction: 'avg',
          aggregateMetric: 'actionCount',
          aggregateBy: ['actionType'],
        };
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `items/${item.id}/actions/aggregation`,
          query: parameters,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if query parameters are invalid (perform numeric function on a non numeric expression)', async () => {
        const members = await saveMembers(MEMBERS);
        const { item } = await saveItemAndMembership({ member: actor });
        await saveActions(item, members);

        const parameters = {
          requestedSampleSize: 5000,
          view: Context.Builder,
          countGroupBy: ['user', 'createdDay'],
          aggregateFunction: 'avg',
          aggregateMetric: 'user',
          aggregateBy: ['createdDay'],
        };
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `items/${item.id}/actions/aggregation`,
          query: parameters,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
