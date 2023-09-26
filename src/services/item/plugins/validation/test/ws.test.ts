import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { HttpMethod } from '@graasp/sdk';

import { clearDatabase } from '../../../../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { saveItemAndMembership } from '../../../../itemMembership/test/fixtures/memberships';
import { TestWsClient } from '../../../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../../../websockets/test/ws-app';
import { ItemEvent, ItemOpFeedbackEvent, memberItemsTopic } from '../../../ws/events';
import { ItemValidationGroupRepository } from '../repositories/ItemValidationGroup';
import { saveItemValidation } from './utils';

// mock datasource
jest.mock('../../../../../plugins/datasource');

describe('asynchronous feedback', () => {
  let app, actor, address;
  let ws: TestWsClient;

  beforeEach(async () => {
    ({ app, actor, address } = await setupWsApp());
    ws = new TestWsClient(address);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
    ws.close();
  });

  it('member that initated the validate operation receives success feedback', async () => {
    const { item } = await saveItemAndMembership({ member: actor });
    await saveItemValidation({ item });

    const memberUpdates = await ws.subscribe<ItemEvent>({
      topic: memberItemsTopic,
      channel: actor.id,
    });

    const res = await app.inject({
      method: HttpMethod.POST,
      url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
    });
    expect(res.statusCode).toBe(StatusCodes.ACCEPTED);
    expect(res.body).toEqual(item.id);

    await waitForExpect(() => {
      const [feedbackUpdate] = memberUpdates;
      expect(feedbackUpdate).toMatchObject(
        ItemOpFeedbackEvent('validate', [item.id], {
          data: { [item.id]: item },
          errors: [],
        }),
      );
    });
  });

  it('member that initated the validate operation receives failure feedback', async () => {
    const { item } = await saveItemAndMembership({ member: actor });
    await saveItemValidation({ item });

    const memberUpdates = await ws.subscribe<ItemEvent>({
      topic: memberItemsTopic,
      channel: actor.id,
    });

    jest.spyOn(ItemValidationGroupRepository, 'post').mockImplementation(async () => {
      throw new Error('mock error');
    });

    const res = await app.inject({
      method: HttpMethod.POST,
      url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
    });
    expect(res.statusCode).toBe(StatusCodes.ACCEPTED);
    expect(res.body).toEqual(item.id);

    await waitForExpect(() => {
      const [feedbackUpdate] = memberUpdates;
      expect(feedbackUpdate).toMatchObject(
        ItemOpFeedbackEvent('validate', [item.id], {
          error: new Error('mock error'),
        }),
      );
    });
  });
});
