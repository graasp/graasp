import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemOpFeedbackEvent as ItemOpFeedbackEventType } from '@graasp/sdk';

import { clearDatabase } from '../../../../../../test/app';
import { TestWsClient } from '../../../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../../../websockets/test/ws-app';
import { Item } from '../../../entities/Item';
import { ItemTestUtils } from '../../../test/fixtures/items';
import {
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../../../ws/events';
import { ActionRequestExportRepository } from '../requestExport/repository';
import { expectExportFeedbackOp } from './utils';

const testUtils = new ItemTestUtils();

const uploadDoneMock = jest.fn(async () => console.debug('aws s3 storage upload'));
const deleteObjectMock = jest.fn(async () => console.debug('deleteObjectMock'));
const headObjectMock = jest.fn(async () => console.debug('headObjectMock'));
const MOCK_SIGNED_URL = 'signed-url';
jest.mock('@aws-sdk/client-s3', () => {
  return {
    GetObjectCommand: jest.fn(),
    S3: function () {
      return {
        deleteObject: deleteObjectMock,
        putObject: uploadDoneMock,
        headObject: headObjectMock,
      };
    },
  };
});
jest.mock('@aws-sdk/s3-request-presigner', () => {
  const getSignedUrl = jest.fn(async () => MOCK_SIGNED_URL);
  return {
    getSignedUrl,
  };
});
jest.mock('@aws-sdk/lib-storage', () => {
  return {
    Upload: jest.fn().mockImplementation(() => {
      return {
        done: uploadDoneMock,
      };
    }),
  };
});

describe('asynchronous feedback', () => {
  let app: FastifyInstance;
  let actor;
  let address;
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
    const { item } = await testUtils.saveItemAndMembership({ member: actor });
    const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

    const response = await app.inject({
      method: HttpMethod.Post,
      url: `/items/${item.id}/actions/export`,
    });
    expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

    await waitForExpect(() => {
      const [feedbackUpdate] = memberUpdates as ItemOpFeedbackEventType<Item, 'export'>[];
      const expected = ItemOpFeedbackEvent('export', [item.id], { [item.id]: item });
      expectExportFeedbackOp(feedbackUpdate, expected);
    });
  });

  it('member that initated the export operation receives failure feedback', async () => {
    const { item } = await testUtils.saveItemAndMembership({ member: actor });
    const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

    jest.spyOn(ActionRequestExportRepository.prototype, 'getLast').mockImplementation(async () => {
      throw new Error('mock error');
    });

    const response = await app.inject({
      method: HttpMethod.Post,
      url: `/items/${item.id}/actions/export`,
    });
    expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

    await waitForExpect(() => {
      const [feedbackUpdate] = memberUpdates;
      expect(feedbackUpdate).toMatchObject(
        ItemOpFeedbackErrorEvent('export', [item.id], new Error('mock error')),
      );
    }, 10000);
  });
});
