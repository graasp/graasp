import FormData from 'form-data';
import { createReadStream } from 'fs';
import { StatusCodes } from 'http-status-codes';
import path from 'path';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ThumbnailSize } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { saveMember } from '../../../test/fixtures/members';
import { UploadFileNotImageError } from '../utils/errors';

const filepath = path.resolve(__dirname, './fixtures/image.png');
const textPath = path.resolve(__dirname, './fixtures/emptyFile');

// mock datasource
jest.mock('../../../../../plugins/datasource');

const deleteObjectMock = jest.fn(async () => console.debug('deleteObjectMock'));
const copyObjectMock = jest.fn(async () => console.debug('copyObjectMock'));
const headObjectMock = jest.fn(async () => ({ ContentLength: 10 }));
const uploadDoneMock = jest.fn(async () => console.debug('aws s3 storage upload'));

const MOCK_SIGNED_URL = 'signed-url';
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

describe('Thumbnail Plugin Tests', () => {
  let app: FastifyInstance;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('GET /:id/avatar/:size', () => {
    it('Get member avatar', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `members/${member.id}/avatar/${ThumbnailSize.Small}`,
      });

      expect(response.statusCode).toBe(StatusCodes.MOVED_TEMPORARILY);
      expect(response.headers.location).toBe(MOCK_SIGNED_URL);
    });

    describe('Public', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
      });

      it('Successfully redirect to thumbnails of all different sizes', async () => {
        const member = await saveMember();
        for (const size of Object.values(ThumbnailSize)) {
          const response = await app.inject({
            method: HttpMethod.Get,
            url: `members/${member.id}/avatar/${size}`,
          });
          expect(response.statusCode).toBe(StatusCodes.MOVED_TEMPORARILY);
          expect(response.headers.location).toBe(MOCK_SIGNED_URL);
        }
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Successfully redirect to thumbnails of all different sizes', async () => {
        for (const size of Object.values(ThumbnailSize)) {
          const response = await app.inject({
            method: HttpMethod.Get,
            url: `members/${actor.id}/avatar/${size}`,
          });
          expect(response.statusCode).toBe(StatusCodes.MOVED_TEMPORARILY);
          expect(response.headers.location).toBe(MOCK_SIGNED_URL);
        }
      });

      it('Successfully redirect to thumbnails of all different sizes for other member', async () => {
        const member = await saveMember();
        for (const size of Object.values(ThumbnailSize)) {
          const response = await app.inject({
            method: HttpMethod.Get,
            url: `members/${member.id}/avatar/${size}`,
          });
          expect(response.statusCode).toBe(StatusCodes.MOVED_TEMPORARILY);
          expect(response.headers.location).toBe(MOCK_SIGNED_URL);
        }
      });

      it('Return avatar urls of member', async () => {
        const member = await saveMember();
        for (const size of Object.values(ThumbnailSize)) {
          const response = await app.inject({
            method: HttpMethod.Get,
            url: `members/${member.id}/avatar/${size}?replyUrl=true`,
          });

          expect(response.statusCode).toBe(StatusCodes.OK);
          expect(response.body).toBe(MOCK_SIGNED_URL);
        }
      });
    });
  });

  describe('POST /avatar?id=<id>', () => {
    it('Throws if signed out', async () => {
      const fileStream = createReadStream(filepath);
      const form = new FormData();
      form.append('file', fileStream);

      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.Post,
        url: 'members/avatar',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Successfully upload thumbnail', async () => {
        const fileStream2 = createReadStream(filepath);
        const form2 = new FormData();
        form2.append('file', fileStream2);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: 'members/avatar',
          payload: form2,
          headers: form2.getHeaders(),
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
        expect(uploadDoneMock).toHaveBeenCalledTimes(Object.values(ThumbnailSize).length);
      });

      it('Throw if try to upload a non-image file', async () => {
        const textFileStream = createReadStream(textPath);
        const form = new FormData();
        form.append('file', textFileStream);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: 'members/avatar',
          payload: form,
          headers: form.getHeaders(),
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(res.json()).toEqual(new UploadFileNotImageError());
      });
    });
  });
});
