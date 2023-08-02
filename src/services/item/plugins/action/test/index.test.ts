import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { saveItemAndMembership } from '../../../../itemMembership/test/fixtures/memberships';
import { getDummyItem } from '../../../test/fixtures/items';
import { ActionRequestExportRepository } from '../requestExport/repository';

// mock datasource
jest.mock('../../../../../plugins/datasource');

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

describe('Action Plugin Tests', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('POST /:id/actions/export', () => {
    it('Create archive and send email', async () => {
      ({ app, actor } = await build());
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');

      const { item } = await saveItemAndMembership({
        item: getDummyItem(),
        member: actor,
      });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions/export`,
      });

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        expect(uploadDoneMock).toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalled();
      });
    });

    it('Create archive if last export is old and send email', async () => {
      ({ app, actor } = await build());
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');

      const { item } = await saveItemAndMembership({
        item: getDummyItem(),
        member: actor,
      });

      await ActionRequestExportRepository.save({
        item,
        member: actor,
        createdAt: new Date('2021'),
      });

      // another item to add noise
      const { item: otherItem } = await saveItemAndMembership({
        item: getDummyItem(),
        member: actor,
      });
      await ActionRequestExportRepository.save({
        item: otherItem,
        member: actor,
        createdAt: new Date(),
      });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions/export`,
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        expect(uploadDoneMock).toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalled();
      });
    });

    it('Does not create archive if last export is recent, but send email', async () => {
      ({ app, actor } = await build());
      const mockSendEmail = jest.spyOn(app.mailer, 'sendEmail');

      const { item } = await saveItemAndMembership({
        item: getDummyItem(),
        member: actor,
      });

      await ActionRequestExportRepository.save({
        item,
        member: actor,
        createdAt: new Date(),
      });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions/export`,
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        expect(uploadDoneMock).not.toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalled();
      });
    });
  });
});
