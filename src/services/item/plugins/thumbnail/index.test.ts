/* eslint-disable @typescript-eslint/no-non-null-assertion */
import FormData from 'form-data';
import { createReadStream } from 'fs';
import { StatusCodes } from 'http-status-codes';
import path from 'path';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ThumbnailSize } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { ITEMS_ROUTE_PREFIX, THUMBNAILS_ROUTE_PREFIX } from '../../../../utils/config';
import { MemberCannotAccess } from '../../../../utils/errors';
import { saveMember } from '../../../member/test/fixtures/members';
import { ItemTestUtils } from '../../test/fixtures/items';
import { setItemPublic } from '../itemVisibility/test/fixtures';
import { UploadFileNotImageError } from './utils/errors';

const filepath = path.resolve(__dirname, './test/fixtures/image.png');
const textPath = path.resolve(__dirname, './test/fixtures/emptyFile');

const testUtils = new ItemTestUtils();

const deleteObjectMock = jest.fn(async () => console.debug('deleteObjectMock'));
const deleteObjectsMock = jest.fn(async () => console.debug('deleteObjectsMock'));
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
        deleteObjects: deleteObjectsMock,
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

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    actor = null;
    unmockAuthenticate();
  });

  describe('GET /:id/thumbnails/:size', () => {
    it('Throws if item is private', async () => {
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}/${ThumbnailSize.Small}`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    describe('Public', () => {
      let item;

      beforeEach(async () => {
        const member = await saveMember();
        ({ item } = await testUtils.saveItemAndMembership({
          member,
          item: { settings: { hasThumbnail: true } },
        }));
        await setItemPublic(item, member);
      });

      it('Successfully return thumbnail url for all different sizes', async () => {
        for (const size of Object.values(ThumbnailSize)) {
          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}/${size}`,
          });
          expect(response.statusCode).toBe(StatusCodes.OK);
          expect(response.body).toBe(MOCK_SIGNED_URL);
        }
      });
    });

    describe('Signed In', () => {
      let item;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
        ({ item } = await testUtils.saveItemAndMembership({
          member: actor,
          item: { settings: { hasThumbnail: true } },
        }));
      });

      it('Return thumbnail urls of item', async () => {
        for (const size of Object.values(ThumbnailSize)) {
          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}/${size}`,
          });

          expect(response.statusCode).toBe(StatusCodes.OK);
          expect(response.body).toBe(MOCK_SIGNED_URL);
        }
      });

      it('Cannot download without rights', async () => {
        const member = await saveMember();
        const { item: someItem } = await testUtils.saveItemAndMembership({
          member,
        });

        for (const size of Object.values(ThumbnailSize)) {
          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${someItem.id}${THUMBNAILS_ROUTE_PREFIX}/${size}`,
          });

          expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
        }
      });

      it('Return no content if no thumbnail was uploaded', async () => {
        const { item: someItem } = await testUtils.saveItemAndMembership({
          member: actor,
          item: { settings: { hasThumbnail: false } },
        });

        for (const size of Object.values(ThumbnailSize)) {
          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${someItem.id}${THUMBNAILS_ROUTE_PREFIX}/${size}`,
          });

          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json()).toBeNull();
        }
      });
    });
  });

  describe('POST /upload?id=<id>', () => {
    it('Throws if item is private', async () => {
      const fileStream = createReadStream(filepath);
      const form = new FormData();
      form.append('file', fileStream);

      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}`,
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let item;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
        ({ item } = await testUtils.saveItemAndMembership({ member: actor }));
      });

      it('Successfully upload thumbnail', async () => {
        const fileStream2 = createReadStream(filepath);
        const form2 = new FormData();
        form2.append('file', fileStream2);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}`,
          payload: form2,
          headers: form2.getHeaders(),
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
        expect(uploadDoneMock).toHaveBeenCalledTimes(Object.values(ThumbnailSize).length);

        const savedItem = await testUtils.rawItemRepository.findOneBy({ id: item.id });
        expect(savedItem!.settings.hasThumbnail).toBeTruthy();
      });

      it('Throw if try to upload for item without permission', async () => {
        const fileStream4 = createReadStream(filepath);
        const form3 = new FormData();
        form3.append('file', fileStream4);

        const member = await saveMember();
        ({ item } = await testUtils.saveItemAndMembership({ member }));

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}`,
          payload: form3,
          headers: form3.getHeaders(),
        });
        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
        const savedItem = await testUtils.rawItemRepository.findOneBy({ id: item.id });
        expect(savedItem!.settings?.hasThumbnail).toBeFalsy();
      });

      it('Throw if try to upload a non-image file', async () => {
        const textFileStream = createReadStream(textPath);
        const form = new FormData();
        form.append('file', textFileStream);

        const res = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}`,
          payload: form,
          headers: form.getHeaders(),
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(res.json()).toEqual(new UploadFileNotImageError());
        const savedItem = await testUtils.rawItemRepository.findOneBy({ id: item.id });
        expect(savedItem!.settings?.hasThumbnail).toBeFalsy();
      });
    });
  });

  describe('DELETE /:id/thumbnails', () => {
    describe('Signed In', () => {
      let item;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Successfully delete thumbnail', async () => {
        ({ item } = await testUtils.saveItemAndMembership({
          member: actor,
          item: { settings: { hasThumbnail: true } },
        }));
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}`,
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
        const savedItem = await testUtils.rawItemRepository.findOneBy({ id: item.id });
        expect(savedItem!.settings?.hasThumbnail).toBeFalsy();
      });

      it('Throw if try to delete thumbnail for item without permission', async () => {
        const member = await saveMember();
        ({ item } = await testUtils.saveItemAndMembership({
          member,
          item: { settings: { hasThumbnail: true } },
        }));

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}`,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        const savedItem = await testUtils.rawItemRepository.findOneBy({ id: item.id });
        expect(savedItem!.settings?.hasThumbnail).toBeTruthy();
      });
    });
  });
});
