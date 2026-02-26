import { NotFound } from '@aws-sdk/client-s3';
import assert from 'assert';
import { and, eq, inArray } from 'drizzle-orm';
import FormData from 'form-data';
import fs from 'fs';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import path from 'path';

import type { FastifyInstance } from 'fastify';

import { DescriptionPlacement, type FileItemExtra, HttpMethod, MaxWidth } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { MULTIPLE_ITEMS_LOADING_TIME } from '../../../../../test/constants';
import { buildFile, seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { isDirectChild } from '../../../../drizzle/operations';
import { itemMembershipsTable, itemsRawTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { MemberCannotAccess, MemberCannotWriteItem } from '../../../../utils/errors';
import {
  DownloadFileInvalidParameterError,
  DownloadFileUnexpectedError,
  S3FileNotFound,
  UploadEmptyFileError,
  UploadFileUnexpectedError,
} from '../../../file/utils/errors';
import { ThumbnailSizeFormat } from '../../../thumbnail/constants';
import { expectItem } from '../../test/fixtures/items';
import { DEFAULT_MAX_STORAGE } from './utils/constants';
import { StorageExceeded } from './utils/errors';

const getItemById = async (id: string) =>
  await db.query.itemsRawTable.findFirst({ where: eq(itemsRawTable.id, id) });
const getItemMembershipByPath = async (path: string) =>
  await db.query.itemMembershipsTable.findFirst({
    where: eq(itemMembershipsTable.itemPath, path),
  });

const deleteObjectsMock = jest.fn(async () => console.debug('deleteObjects'));
const copyObjectMock = jest.fn(async () => console.debug('copyObjectMock'));
const headObjectMock = jest.fn(async () => ({ ContentLength: 10 }));
const uploadDoneMock = jest.fn(async () => console.debug('aws s3 storage upload'));

const MOCK_SIGNED_URL = 'signed-url';
jest.mock('@aws-sdk/client-s3', () => {
  return {
    GetObjectCommand: jest.fn(),
    NotFound: jest.fn(() => ({ name: 'NotFound' })),
    S3: function () {
      return {
        copyObject: copyObjectMock,
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

// we need a different form data for each test
const createFormData = (form = new FormData(), filepath: string = './test/fixtures/image.png') => {
  form.append('myfile', fs.createReadStream(path.resolve(__dirname, filepath)));

  return form;
};

const getItemsForActorId = async (actorId: string, parentPath?: string) => {
  const conditions = [eq(itemsRawTable.creatorId, actorId)];

  if (parentPath) {
    conditions.push(isDirectChild(itemsRawTable.path, parentPath));
  }

  return await db.query.itemsRawTable.findMany({
    where: and(...conditions),
  });
};

describe('File Item routes tests', () => {
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

  describe('POST /upload', () => {
    it('Throws if signed out', async () => {
      const form = createFormData();

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/upload',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      describe('Without error', () => {
        it('Upload successfully one file', async () => {
          const { actor } = await seedFromJson();
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const form = createFormData();
          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });
          // check response value
          expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

          // check item exists in db
          const [item] = await getItemsForActorId(actor.id);

          // s3 upload function: We expect on image AND the thumbnails
          expect(uploadDoneMock).toHaveBeenCalledTimes(
            Object.entries(ThumbnailSizeFormat).length + 1,
          );

          // check file properties
          // TODO: more precise check
          expect(item?.extra['file']).toBeTruthy();

          // a membership is created for this item
          const membership = await getItemMembershipByPath(item.path);
          expect(membership?.permission).toEqual('admin');
        });

        it('Upload successfully one pdf file with thumbnail', async () => {
          const { actor } = await seedFromJson();
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const form = createFormData(new FormData(), './test/fixtures/blank.pdf');

          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });
          // check response value
          expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

          // check item exists in db
          const [item] = await getItemsForActorId(actor.id);

          // s3 upload function: We expect on pdf and the thumbnails
          expect(uploadDoneMock).toHaveBeenCalledTimes(
            Object.entries(ThumbnailSizeFormat).length + 1,
          );
          expect(item?.extra['file']).toBeTruthy();
        });

        it('Upload successfully many files', async () => {
          const { actor } = await seedFromJson();
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const form = createFormData();
          const form1 = createFormData(form);

          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form1,
            headers: form1.getHeaders(),
          });

          // check response value
          expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

          // check items exist in db
          const newItems = await getItemsForActorId(actor.id);
          expect(newItems).toHaveLength(2);

          // s3 upload function: We expect on image AND the thumbnails
          expect(uploadDoneMock).toHaveBeenCalledTimes(
            Object.entries(ThumbnailSizeFormat).length * 2 + 2,
          );

          // check file properties
          // TODO: more precise check
          for (const item of newItems) {
            expect(item?.extra['file']).toBeTruthy();
          }
          // a membership is created for this item
          const memberships = await db.query.itemMembershipsTable.findMany({
            where: inArray(
              itemMembershipsTable.itemPath,
              newItems.map(({ path }) => path),
            ),
          });
          for (const m of memberships) {
            expect(m?.permission).toEqual('admin');
          }
        });

        it('Upload successfully one file in parent', async () => {
          const {
            actor,
            items: [parentItem],
          } = await seedFromJson({
            items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const form = createFormData();
          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload?id=${parentItem.id}`,
            payload: form,
            headers: form.getHeaders(),
          });

          // check response value
          expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

          // check item exists in db
          const [newItem] = await getItemsForActorId(actor.id, parentItem.path);

          // s3 upload function: We expect on image AND the thumbnails
          expect(uploadDoneMock).toHaveBeenCalledTimes(
            Object.entries(ThumbnailSizeFormat).length + 1,
          );

          // check file properties
          // TODO: more precise check
          expect(newItem?.extra['file']).toBeTruthy();
          expect(newItem?.path).toContain(parentItem.path);

          // a membership is not created for new item because it inherits parent
          const membership = await db.query.itemMembershipsTable.findFirst({
            where: eq(itemMembershipsTable.itemPath, newItem.path),
          });
          expect(membership).toBeUndefined();
        });

        it('Upload several files with one H5P file', async () => {
          const { actor } = await seedFromJson();
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const form = createFormData();
          form.append(
            'H5PFile',
            fs.createReadStream(path.resolve(__dirname, './test/fixtures/dummy.h5p')),
          );

          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });

          // check the response value
          expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
          const newItems = await getItemsForActorId(actor.id);
          expect(newItems).toHaveLength(2);

          // check that both items exist in db and that their types are correctly interpreted
          const imageItem = await getItemById(newItems[0].id);
          expectItem(imageItem, newItems[0]);
          expect(imageItem?.type).toEqual('file');

          const h5pItem = await getItemById(newItems[1].id);
          expectItem(h5pItem, newItems[1]);
          expect(h5pItem?.type).toBe('h5p');
        });

        it('Cannot upload in parent with read rights', async () => {
          const {
            actor,
            items: [parentItem],
          } = await seedFromJson({
            items: [{ memberships: [{ account: 'actor', permission: 'read' }] }],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const form = createFormData();

          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload?id=${parentItem.id}`,
            payload: form,
            headers: form.getHeaders(),
          });

          expect(response.json()).toMatchObject(new MemberCannotWriteItem(expect.anything()));

          // s3 upload function
          expect(uploadDoneMock).not.toHaveBeenCalled();
        });

        it('Cannot upload with storage exceeded', async () => {
          const { actor } = await seedFromJson({
            items: [buildFile('actor', { size: DEFAULT_MAX_STORAGE + 1 })],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const form = createFormData();
          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });

          const error = new StorageExceeded();
          expect(response.statusCode).toEqual(error.statusCode);
          expect(response.json().message).toMatch(error.message);
        });

        it('Cannot upload empty file', async () => {
          const { actor } = await seedFromJson();
          assertIsDefined(actor);
          mockAuthenticate(actor);

          headObjectMock.mockImplementation(async () => ({ ContentLength: 0 }));
          const form = new FormData();
          form.append(
            'myfile',
            fs.createReadStream(path.resolve(__dirname, './test/fixtures/emptyFile')),
          );

          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });

          const error = new UploadEmptyFileError();
          expect(response.statusCode).toEqual(error.statusCode);
          expect(response.json().message).toEqual(error.message);
          expect(deleteObjectsMock).toHaveBeenCalled();
        });
      });

      describe('With error', () => {
        it('Check rollback if one file fails, keep one successful file', async () => {
          // this simulates an empty file among 2 files -> that triggers an error
          headObjectMock
            .mockResolvedValueOnce({ ContentLength: 0 })
            .mockResolvedValueOnce({ ContentLength: 10 });

          const form = new FormData();
          form.append(
            'myfile',
            fs.createReadStream(path.resolve(__dirname, './test/fixtures/emptyFile')),
          );

          const form1 = createFormData(form);

          const { actor } = await seedFromJson();
          assertIsDefined(actor);
          mockAuthenticate(actor);
          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form1,
            headers: form1.getHeaders(),
          });

          expect(response.statusCode).not.toBe(StatusCodes.NO_CONTENT);

          // one empty file error
          expect(response.json().message).toEqual(new UploadEmptyFileError().message);

          // upload 2 files and one set of thumbnails
          expect(uploadDoneMock).toHaveBeenCalledTimes(
            Object.values(ThumbnailSizeFormat).length + 2,
          );
          expect(deleteObjectsMock).toHaveBeenCalledTimes(1);

          // one file has been uploaded
          const uploadedItems = await getItemsForActorId(actor.id);
          expect(uploadedItems).toHaveLength(1);

          expect(uploadedItems[0].type).toEqual('file');
        });
        it('Throws if s3 upload throws', async () => {
          uploadDoneMock.mockImplementation(() => {
            throw new Error('putObject throws');
          });

          const { actor } = await seedFromJson();
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const form = createFormData();
          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });

          const error = new UploadFileUnexpectedError();
          expect(response.statusCode).toEqual(error.statusCode);
          expect(response.json().message).toMatch(error.message);
        });
      });
    });
  });

  describe('GET /download', () => {
    describe('Sign out', () => {
      it('Throws if signed out and item is private', async () => {
        const {
          items: [item],
        } = await seedFromJson({
          actor: null,
          items: [{}],
        });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });

      it('Download public file item', async () => {
        const {
          items: [item],
        } = await seedFromJson({
          items: [
            {
              ...buildFile({ name: 'bob' }),
              isPublic: true,
            },
          ],
        });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.body).toBe(MOCK_SIGNED_URL);
      });
    });

    describe('Signed In', () => {
      describe('Without error', () => {
        it('Return file url of item', async () => {
          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [buildFile('actor')],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
          });

          expect(response.statusCode).toBe(StatusCodes.OK);
          expect(response.body).toBe(MOCK_SIGNED_URL);
        });

        it('Cannot download without rights', async () => {
          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [buildFile({ name: 'bob' })],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
          });

          expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
        });

        it('Cannot download non-file item', async () => {
          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [
              {
                memberships: [{ account: 'actor', permission: 'read' }],
              },
            ],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
          });

          expect(response.json()).toMatchObject(
            JSON.parse(JSON.stringify(new DownloadFileInvalidParameterError())),
          );
        });
      });

      describe('With error', () => {
        it('Gracefully fails if s3 headObject throws', async () => {
          headObjectMock.mockImplementation(() => {
            throw new Error('headObject throws');
          });

          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [buildFile('actor')],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
          });

          // we want the download file to wrap the error
          expect(response.json()).toMatchObject(new DownloadFileUnexpectedError(expect.anything()));
        });
        it('Gracefully fails if s3 returns NotFound error', async () => {
          headObjectMock.mockImplementation(() => {
            throw new NotFound({ message: 'hello', $metadata: {} });
          });

          const {
            actor,
            items: [item],
          } = await seedFromJson({
            items: [buildFile('actor')],
          });
          assertIsDefined(actor);
          mockAuthenticate(actor);

          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
          });

          // we want the download file to wrap the error
          expect(response.json()).toMatchObject(new S3FileNotFound(expect.anything()));
        });
      });
    });
  });

  describe('Edit file - PATCH /items/id', () => {
    it('Edit name for file item', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            ...buildFile('actor'),
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}`,
        payload: { name: 'newName' },
      });
      expect(response.json().name).toEqual('newName');
    });

    it('Edit file item altText', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            ...buildFile('actor'),
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}`,
        payload: { extra: { ['file']: { altText: 'new name' } } },
      });
      expect(response.json().extra['file'].altText).toEqual('new name');
    });

    it('Edit file item maxWidth', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            ...buildFile('actor'),
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}`,
        payload: { settings: { maxWidth: MaxWidth.Small } },
      });
      expect(response.json().settings.maxWidth).toEqual(MaxWidth.Small);
    });

    it('Cannot edit another file item field', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            ...buildFile('actor'),
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}`,
        payload: { extra: { ['file']: { size: 10 } } },
      });
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('Hooks', () => {
    describe('Delete Post Hook', () => {
      it('Do not trigger file delete if item is not a file item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}?id=${item.id}`,
        });

        await new Promise((done) => {
          setTimeout(async () => {
            await expect(deleteObjectsMock).not.toHaveBeenCalled();

            done(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Delete corresponding file for file item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              ...buildFile({ name: 'bob' }),
              memberships: [{ account: 'actor', permission: 'admin' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}?id=${item.id}`,
        });

        await new Promise((done) => {
          setTimeout(async () => {
            await expect(deleteObjectsMock).toHaveBeenCalled();

            done(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
    });

    describe('Copy Pre Hook', () => {
      it('Stop if item is not a file item', async () => {
        const {
          actor,
          items: [parentItem, item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              children: [{}],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/copy`,
          payload: {
            parentId: parentItem.id,
          },
        });

        await new Promise((done) => {
          setTimeout(async () => {
            await expect(copyObjectMock).not.toHaveBeenCalled();

            done(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Copy corresponding file for file item', async () => {
        const {
          actor,
          items: [_parentItem, item, target],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              children: [buildFile('actor'), {}],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/copy?id=${item.id}`,
          payload: {
            parentId: target.id,
          },
        });

        await new Promise((done) => {
          setTimeout(async () => {
            await expect(copyObjectMock).toHaveBeenCalled();

            const items = await db.query.itemsRawTable.findMany({
              where: eq(itemsRawTable.name, item.name),
            });
            expect(items).toHaveLength(2);

            expect((items[0].extra as FileItemExtra).file.path).not.toEqual(
              (items[1].extra as FileItemExtra).file.path,
            );

            done(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });

      it('Prevent copy if member storage is exceeded', async () => {
        const {
          actor,
          items: [parentItem, item],
        } = await seedFromJson({
          items: [
            {
              children: [
                {
                  type: 'file',
                  extra: {
                    ['file']: {
                      size: DEFAULT_MAX_STORAGE,
                      name: 'name',
                      mimetype: 'mimetype',
                      path: 'filepath',
                      content: 'content',
                    },
                  },
                  memberships: [{ account: 'actor', permission: 'admin' }],
                },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/copy?id=${item.id}`,
          payload: {
            parentId: parentItem.id,
          },
        });

        await new Promise((done) => {
          setTimeout(async () => {
            await expect(copyObjectMock).not.toHaveBeenCalled();
            // did not copy
            expect(
              await db.query.itemsRawTable.findMany({ where: eq(itemsRawTable.name, item.name) }),
            ).toHaveLength(1);
            done(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
    });
  });

  describe('PATCH /api/items/files/:id', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [buildFile({ name: 'alice' })],
      });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/api/items/files/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Update successfully', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [buildFile('actor')],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
          extra: {
            ['file']: {},
          },
          settings: {
            hasThumbnail: true,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/files/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

        const savedItem = await getItemById(item.id);
        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(savedItem, {
          ...item,
          ...payload,
          extra: item.extra,
        });
      });

      it('Update successfully new language', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [buildFile('actor')],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          lang: 'fr',
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/files/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

        const savedItem = await getItemById(item.id);
        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(savedItem, {
          ...item,
          ...payload,
          extra: item.extra,
        });
      });

      it('Update successfully description placement above', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [buildFile('actor')],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          settings: {
            ...item.settings,
            descriptionPlacement: DescriptionPlacement.ABOVE,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/files/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

        const savedItem = await getItemById(item.id);
        assert(savedItem);

        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(savedItem, {
          ...item,
          ...payload,
        });
        expect(savedItem.settings.descriptionPlacement).toBe(DescriptionPlacement.ABOVE);
        expect(savedItem.settings.hasThumbnail).toBeFalsy();
      });

      it('Filter out bad setting when updating', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [buildFile('actor')],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const BAD_SETTING = { INVALID: 'Not a valid setting' };
        const VALID_SETTING = { descriptionPlacement: DescriptionPlacement.ABOVE };
        const payload = {
          settings: {
            ...item.settings,
            ...VALID_SETTING,
            ...BAD_SETTING,
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/files/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

        const savedItem = await getItemById(item.id);
        assert(savedItem);

        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(savedItem, {
          ...item,
          ...payload,
          settings: VALID_SETTING,
        });
        expect(savedItem.settings.descriptionPlacement).toBe(VALID_SETTING.descriptionPlacement);
        expect(Object.keys(savedItem.settings)).not.toContain(Object.keys(BAD_SETTING)[0]);
      });

      it('Bad request if id is invalid', async () => {
        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: '/api/items/files/invalid-id',
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Cannot update item if does not have membership', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [buildFile({ name: 'alice' })],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/files/${item.id}`,
          payload,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
      it('Cannot update item if has only read membership', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              ...buildFile({ name: 'bob' }),
              memberships: [{ account: 'actor', permission: 'read' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/files/${item.id}`,
          payload,
        });

        expect(response.json()).toEqual(new MemberCannotWriteItem(item.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
});
