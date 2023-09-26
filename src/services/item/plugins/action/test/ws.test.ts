import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { HttpMethod } from '@graasp/sdk';

import { clearDatabase } from '../../../../../../test/app';
import { saveItemAndMembership } from '../../../../itemMembership/test/fixtures/memberships';
import { TestWsClient } from '../../../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../../../websockets/test/ws-app';
import { ItemOpFeedbackEvent, memberItemsTopic } from '../../../ws/events';
import { ActionRequestExportRepository } from '../requestExport/repository';

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

  it('member that initated the export operation receives success feedback', async () => {
    const { item } = await saveItemAndMembership({ member: actor });
    const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

    const response = await app.inject({
      method: HttpMethod.POST,
      url: `/items/${item.id}/actions/export`,
    });
    expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

    await waitForExpect(() => {
      const [feedbackUpdate] = memberUpdates;
      expect(feedbackUpdate).toMatchObject(
        ItemOpFeedbackEvent('export', [item.id], { data: { [item.id]: item }, errors: [] }),
      );
    });
  });

  it('member that initated the export operation receives failure feedback', async () => {
    const { item } = await saveItemAndMembership({ member: actor });
    const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

    jest.spyOn(ActionRequestExportRepository, 'getLast').mockImplementation(async () => {
      throw new Error('mock error');
    });

    const response = await app.inject({
      method: HttpMethod.POST,
      url: `/items/${item.id}/actions/export`,
    });
    expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

    await waitForExpect(() => {
      const [feedbackUpdate] = memberUpdates;
      expect(feedbackUpdate).toMatchObject(
        ItemOpFeedbackEvent('export', [item.id], { error: new Error('mock error') }),
      );
    });
  });
});
