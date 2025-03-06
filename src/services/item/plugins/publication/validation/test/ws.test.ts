import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemOpFeedbackEvent as ItemOpFeedbackEventType } from '@graasp/sdk';

import { clearDatabase } from '../../../../../../../test/app';
import { Item } from '../../../../../../drizzle/types';
import { ITEMS_ROUTE_PREFIX } from '../../../../../../utils/config';
import { TestWsClient } from '../../../../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../../../../websockets/test/ws-app';
import { ItemTestUtils } from '../../../../test/fixtures/items';
import {
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../../../../ws/events';
import { expectValidateFeedbackOp } from '../../../action/test/utils';
import { ItemValidationGroupRepository } from '../ItemValidationGroup.repository';
import { saveItemValidation } from './utils';

const testUtils = new ItemTestUtils();

describe('asynchronous feedback', () => {
  let app: FastifyInstance;
  let actor, address;
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
    const { item } = await testUtils.saveItemAndMembership({ member: actor });
    await saveItemValidation({ item });

    const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<Item, 'validate'>>({
      topic: memberItemsTopic,
      channel: actor.id,
    });

    const res = await app.inject({
      method: HttpMethod.Post,
      url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
    });
    expect(res.statusCode).toBe(StatusCodes.ACCEPTED);
    expect(res.body).toEqual(item.id);

    await waitForExpect(() => {
      const [feedbackUpdate] = memberUpdates;
      expectValidateFeedbackOp(
        feedbackUpdate,
        ItemOpFeedbackEvent('validate', [item.id], { [item.id]: item }),
      );
    });
  });

  it('member that initated the validate operation receives failure feedback', async () => {
    const { item } = await testUtils.saveItemAndMembership({ member: actor });
    await saveItemValidation({ item });

    const memberUpdates = await ws.subscribe<ItemOpFeedbackEventType<Item, 'validate'>>({
      topic: memberItemsTopic,
      channel: actor.id,
    });

    jest.spyOn(ItemValidationGroupRepository.prototype, 'post').mockImplementation(async () => {
      throw new Error('mock error');
    });

    const res = await app.inject({
      method: HttpMethod.Post,
      url: `${ITEMS_ROUTE_PREFIX}/${item.id}/validate`,
    });
    expect(res.statusCode).toBe(StatusCodes.ACCEPTED);
    expect(res.body).toEqual(item.id);

    await waitForExpect(() => {
      const [feedbackUpdate] = memberUpdates;
      expectValidateFeedbackOp(
        feedbackUpdate,
        ItemOpFeedbackErrorEvent('validate', [item.id], new Error('mock error')),
      );
    });
  });
});
