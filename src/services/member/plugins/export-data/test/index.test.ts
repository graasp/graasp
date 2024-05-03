/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { MEMBER_EXPORT_DATA_ROUTE_PREFIX } from '../../../../../utils/config';
import { ItemTestUtils } from '../../../../item/test/fixtures/items';

// mock datasource
jest.mock('../../../../../plugins/datasource');

const testUtils = new ItemTestUtils();

const POST_URL = `/members${MEMBER_EXPORT_DATA_ROUTE_PREFIX}`;

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

describe('Export Member Data Plugin Tests', () => {
  let app: FastifyInstance;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('POST /export-data', () => {
    it('Cannot post action when signed out', async () => {
      ({ app, actor } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.Post,
        url: POST_URL,
      });

      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    it('Create archive and send email', async () => {
      ({ app, actor } = await build());
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');

      await testUtils.saveItem({ actor });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: POST_URL,
      });

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        expect(uploadDoneMock).toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalled();
      });
    });
  });
});
