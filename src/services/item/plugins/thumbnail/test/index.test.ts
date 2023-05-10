import FormData from 'form-data';
import { createReadStream } from 'fs';
import { StatusCodes } from 'http-status-codes';
import path from 'path';

import { HttpMethod, ThumbnailSize } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { ITEMS_ROUTE_PREFIX, THUMBNAILS_ROUTE_PREFIX } from '../../../../../utils/config';
import { MemberCannotAccess } from '../../../../../utils/errors';
import { saveItemAndMembership } from '../../../../itemMembership/test/fixtures/memberships';
import { BOB, saveMember } from '../../../../member/test/fixtures/members';
import { ItemRepository } from '../../../repository';
import { setItemPublic } from '../../itemTag/test/fixtures';
import { UploadFileNotImageError } from '../utils/errors';

const filepath = path.resolve(__dirname, './fixtures/image.png');
const textPath = path.resolve(__dirname, './fixtures/emptyFile');

// mock datasource
jest.mock('../../../../../plugins/datasource');

const putObjectMock = jest.fn(async () => console.debug('putObjectMock'));
const deleteObjectMock = jest.fn(async () => console.debug('deleteObjectMock'));
const copyObjectMock = jest.fn(async () => console.debug('copyObjectMock'));
const headObjectMock = jest.fn(async () => console.debug('headObjectMock'));
const MOCK_SIGNED_URL = 'signed-url';
jest.mock('@aws-sdk/client-s3', () => {
  return {
    GetObjectCommand: jest.fn(),
    S3: function () {
      return {
        copyObject: copyObjectMock,
        deleteObject: deleteObjectMock,
        putObject: putObjectMock,
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

describe('Thumbnail Plugin Tests', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('GET /:id/thumbnails/:size', () => {
    it('Throws if item is private', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}/${ThumbnailSize.Small}`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    describe('Public', () => {
      let item;

      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));
        await setItemPublic(item, member);
      });

      it('Successfully redirect to thumbnails of all different sizes', async () => {
        for (const size of Object.values(ThumbnailSize)) {
          const response = await app.inject({
            method: HttpMethod.GET,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}/${size}`,
          });
          expect(response.statusCode).toBe(StatusCodes.MOVED_TEMPORARILY);
          expect(response.headers.location).toBe(MOCK_SIGNED_URL);
        }
      });
    });

    describe('Signed In', () => {
      let item;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await saveItemAndMembership({ member: actor }));
      });

      it('Successfully redirect to thumbnails of all different sizes', async () => {
        for (const size of Object.values(ThumbnailSize)) {
          const response = await app.inject({
            method: HttpMethod.GET,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}/${size}`,
          });
          expect(response.statusCode).toBe(StatusCodes.MOVED_TEMPORARILY);
          expect(response.headers.location).toBe(MOCK_SIGNED_URL);
        }
      });

      it('Return thumbnail urls of item', async () => {
        for (const size of Object.values(ThumbnailSize)) {
          const response = await app.inject({
            method: HttpMethod.GET,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}/${size}?replyUrl=true`,
          });

          expect(response.statusCode).toBe(StatusCodes.OK);
          expect(response.body).toBe(MOCK_SIGNED_URL);
        }
      });

      it('Cannot download without rights', async () => {
        const member = await saveMember(BOB);
        const { item: someItem } = await saveItemAndMembership({
          member,
        });

        for (const size of Object.values(ThumbnailSize)) {
          const response = await app.inject({
            method: HttpMethod.GET,
            url: `${ITEMS_ROUTE_PREFIX}/${someItem.id}${THUMBNAILS_ROUTE_PREFIX}/${size}`,
          });

          expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
        }
      });
    });
  });

  describe('POST /upload?id=<id>', () => {
    it('Throws if item is private', async () => {
      const fileStream = createReadStream(filepath);
      const form = new FormData();
      form.append('file', fileStream);

      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}`,
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    // TODO: PUBLIC

    describe('Signed In', () => {
      let item;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await saveItemAndMembership({ member: actor }));
      });

      it('Successfully upload thumbnail', async () => {
        const fileStream2 = createReadStream(filepath);
        const form2 = new FormData();
        form2.append('file', fileStream2);

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}`,
          payload: form2,
          headers: form2.getHeaders(),
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
        expect(putObjectMock).toHaveBeenCalledTimes(Object.values(ThumbnailSize).length);

        const savedItem = await ItemRepository.findOneBy({ id: item.id });
        expect(savedItem!.settings.hasThumbnail).toBeTruthy();
      });

      it('Throw if try to upload for item without permission', async () => {
        const fileStream4 = createReadStream(filepath);
        const form3 = new FormData();
        form3.append('file', fileStream4);

        const member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}`,
          payload: form3,
          headers: form3.getHeaders(),
        });
        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
        const savedItem = await ItemRepository.findOneBy({ id: item.id });
        expect(savedItem!.settings?.hasThumbnail).toBeFalsy();
      });

      it('Throw if try to upload a non-image file', async () => {
        const textFileStream = createReadStream(textPath);
        const form = new FormData();
        form.append('file', textFileStream);

        const res = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}${THUMBNAILS_ROUTE_PREFIX}`,
          payload: form,
          headers: form.getHeaders(),
        });

        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(res.json()).toEqual(new UploadFileNotImageError());
        const savedItem = await ItemRepository.findOneBy({ id: item.id });
        expect(savedItem!.settings?.hasThumbnail).toBeFalsy();
      });
    });
  });
});
