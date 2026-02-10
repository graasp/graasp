import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, type ItemOpFeedbackEvent as ItemOpFeedbackEventType } from '@graasp/sdk';

import { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../../../../test/app';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { db } from '../../../../../drizzle/db';
import { assertIsDefined } from '../../../../../utils/assertions';
import { TestWsClient } from '../../../../websockets/test/test-websocket-client';
import { setupWsApp } from '../../../../websockets/test/ws-app';
import { type ItemRaw } from '../../../item';
import {
  ItemOpFeedbackErrorEvent,
  ItemOpFeedbackEvent,
  memberItemsTopic,
} from '../../../ws/item.events';
import { ActionRequestExportRepository } from '../requestExport/itemAction.requestExport.repository';
import { expectExportFeedbackOp } from './utils';

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
  let address: string;
  let ws: TestWsClient;

  beforeAll(async () => {
    ({ app, address } = await setupWsApp());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
    ws.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  it('member that initated the export operation receives success feedback', async () => {
    const {
      actor,
      items: [item],
    } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
    assertIsDefined(actor);
    mockAuthenticate(actor);
    ws = new TestWsClient(address);

    const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

    const response = await app.inject({
      method: HttpMethod.Post,
      url: `/api/items/${item.id}/actions/export`,
    });
    expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

    await waitForExpect(() => {
      const [feedbackUpdate] = memberUpdates as ItemOpFeedbackEventType<ItemRaw, 'export'>[];
      const expected = ItemOpFeedbackEvent('export', [item.id], { [item.id]: item });
      expectExportFeedbackOp(feedbackUpdate, expected);
    });
  });

  it('member that initated the export operation receives failure feedback', async () => {
    const {
      actor,
      items: [item],
    } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
    assertIsDefined(actor);
    mockAuthenticate(actor);
    ws = new TestWsClient(address);

    const memberUpdates = await ws.subscribe({ topic: memberItemsTopic, channel: actor.id });

    jest.spyOn(ActionRequestExportRepository.prototype, 'getLast').mockImplementation(async () => {
      throw new Error('mock error');
    });

    const response = await app.inject({
      method: HttpMethod.Post,
      url: `/api/items/${item.id}/actions/export`,
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
