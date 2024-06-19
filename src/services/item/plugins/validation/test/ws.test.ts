import { StatusCodes } from 'http-status-codes';

import { HttpMethod } from '@graasp/sdk';

import { clearDatabase } from '../../../../../../test/app.js';
import { waitForExpect } from '../../../../../../test/assertions/waitForExpect.js';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config.js';
import { TestWsClient } from '../../../../websockets/test/test-websocket-client.js';
import { setupWsApp } from '../../../../websockets/test/ws-app.js';
import { ItemTestUtils } from '../../../test/fixtures/items.js';
import {
  ItemEvent,
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../../../ws/events.js';
import { ItemValidationGroupRepository } from '../repositories/ItemValidationGroup.js';
import { saveItemValidation } from './utils.js';

// mock datasource
jest.mock('../../../../../plugins/datasource');
const testUtils = new ItemTestUtils();

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
    const { item } = await testUtils.saveItemAndMembership({ member: actor });
    await saveItemValidation({ item });

    const memberUpdates = await ws.subscribe<ItemEvent>({
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
      expect(feedbackUpdate).toMatchObject(
        ItemOpFeedbackEvent('validate', [item.id], { [item.id]: item }),
      );
    });
  });

  it('member that initated the validate operation receives failure feedback', async () => {
    const { item } = await testUtils.saveItemAndMembership({ member: actor });
    await saveItemValidation({ item });

    const memberUpdates = await ws.subscribe<ItemEvent>({
      topic: memberItemsTopic,
      channel: actor.id,
    });

    jest.spyOn(ItemValidationGroupRepository, 'post').mockImplementation(async () => {
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
      expect(feedbackUpdate).toMatchObject(
        ItemOpFeedbackErrorEvent('validate', [item.id], new Error('mock error')),
      );
    });
  });
});
