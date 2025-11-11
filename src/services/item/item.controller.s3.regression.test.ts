import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { assertIsDefined } from '../../utils/assertions';
import { assertIsMemberForTest } from '../authentication';

// Mock S3 libraries
const deleteObjectMock = jest.fn(async () => console.debug('deleteObjectMock'));
const copyObjectMock = jest.fn(async () => console.debug('copyObjectMock'));
const headObjectMock = jest.fn(async () => ({ ContentLength: 10 }));
const uploadDoneMock = jest.fn(async () => console.debug('aws s3 storage upload'));
jest.mock('@aws-sdk/client-s3', () => {
  return {
    GetObjectCommand: jest.fn(),
    S3: function () {
      return {
        copyObject: copyObjectMock,
        deleteObject: deleteObjectMock,
        headObject: headObjectMock,
      };
    },
  };
});
jest.mock('@aws-sdk/s3-request-presigner', () => {
  const getSignedUrl = jest.fn(async () => {
    throw new Error('');
  });
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

describe('Item routes tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });
  it('Thumbnails do not crash the server', async () => {
    const {
      actor,
      items: [_parent, _child1, childOfChild],
    } = await seedFromJson({
      items: [
        {
          memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
          children: [{ settings: { hasThumbnail: true }, children: [{}] }],
        },
        {},
      ],
    });
    assertIsDefined(actor);
    assertIsMemberForTest(actor);
    mockAuthenticate(actor);

    const response = await app.inject({
      method: HttpMethod.Get,
      url: `/items/${childOfChild.id}/parents`,
    });

    expect(response.json()[1]).not.toHaveProperty('thumbnails');

    function sleep(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // wait 3 seconds
    await sleep(3000);

    // server should still not be dead
    const otherCall = await app.inject({
      method: HttpMethod.Get,
      url: '/api/version',
    });
    expect(otherCall.statusCode).toBe(StatusCodes.OK);
  });
});
