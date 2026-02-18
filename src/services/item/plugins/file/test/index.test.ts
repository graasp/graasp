import { NotFound } from '@aws-sdk/client-s3';
import FormData from 'form-data';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import { In } from 'typeorm';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, MaxWidth, PermissionLevel, S3FileItemExtra } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { MULTIPLE_ITEMS_LOADING_TIME } from '../../../../../../test/constants';
import { AppDataSource } from '../../../../../plugins/datasource';
import {
  FILE_ITEM_TYPE,
  ITEMS_ROUTE_PREFIX,
  S3_FILE_ITEM_PLUGIN,
} from '../../../../../utils/config';
import { MemberCannotAccess, MemberCannotWriteItem } from '../../../../../utils/errors';
import {
  DownloadFileInvalidParameterError,
  DownloadFileUnexpectedError,
  S3FileNotFound,
  UploadEmptyFileError,
  UploadFileUnexpectedError,
} from '../../../../file/utils/errors';
import { ItemTestUtils, expectItem, expectManyItems } from '../../../../item/test/fixtures/items';
import { ItemMembership } from '../../../../itemMembership/entities/ItemMembership';
import { saveMember } from '../../../../member/test/fixtures/members';
import { ThumbnailSizeFormat } from '../../../../thumbnail/constants';
import { Item } from '../../../entities/Item';
import { setItemPublic } from '../../itemVisibility/test/fixtures';
import { DEFAULT_MAX_STORAGE } from '../utils/constants';
import { StorageExceeded } from '../utils/errors';

// TODO: LOCAL FILE TESTS

const testUtils = new ItemTestUtils();
const itemMembershipRawRepository = AppDataSource.getRepository(ItemMembership);

const deleteObjectMock = jest.fn(async () => console.debug('deleteObjectMock'));
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

// we need a different form data for each test
const createFormData = (form = new FormData(), filepath: string = './fixtures/image.png') => {
  form.append('myfile', fs.createReadStream(path.resolve(__dirname, filepath)));

  return form;
};

describe('File Item routes tests', () => {
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

  describe('POST /upload', () => {
    it('Throws if signed out', async () => {
      const form = createFormData();

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/upload',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      describe('Without error', () => {
        beforeEach(async () => {
          actor = await saveMember();
          mockAuthenticate(actor);
        });

        it('Upload successfully one file', async () => {
          const form = createFormData();

          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });
          // check response value
          const [newItem] = Object.values(response.json().data) as Item[];
          expect(response.statusCode).toBe(StatusCodes.OK);

          // check item exists in db
          const item = await testUtils.rawItemRepository.findOneBy({ type: FILE_ITEM_TYPE });
          expectItem(item, newItem);

          // s3 upload function: We expect on image AND the thumbnails
          expect(uploadDoneMock).toHaveBeenCalledTimes(
            Object.entries(ThumbnailSizeFormat).length + 1,
          );

          // check file properties
          // TODO: more precise check
          expect(item?.extra[FILE_ITEM_TYPE]).toBeTruthy();

          // a membership is created for this item
          const membership = await itemMembershipRawRepository.findOneBy({
            item: { id: newItem.id },
          });
          expect(membership?.permission).toEqual(PermissionLevel.Admin);
        });

        it('Upload successfully one pdf file with thumbnail', async () => {
          const form = createFormData(new FormData(), './fixtures/blank.pdf');

          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });
          // check response value
          const [newItem] = Object.values(response.json().data) as Item[];
          expect(response.statusCode).toBe(StatusCodes.OK);

          // check item exists in db
          const item = await testUtils.rawItemRepository.findOneBy({ id: newItem.id });
          expectItem(item, newItem);

          // s3 upload function: We expect on pdf and the thumbnails
          expect(uploadDoneMock).toHaveBeenCalledTimes(
            Object.entries(ThumbnailSizeFormat).length + 1,
          );
          expect(item?.extra[FILE_ITEM_TYPE]).toBeTruthy();
        });

        it('Upload successfully many files', async () => {
          const form = createFormData();
          const form1 = createFormData(form);

          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form1,
            headers: form1.getHeaders(),
          });

          // check response value
          const items = Object.values(response.json().data) as Item[];
          expect(response.statusCode).toBe(StatusCodes.OK);

          // check item exists in db
          const newItems = await testUtils.rawItemRepository.findBy({
            id: In(items.map(({ id }) => id)),
          });
          expectManyItems(items, newItems);

          // s3 upload function: We expect on image AND the thumbnails
          expect(uploadDoneMock).toHaveBeenCalledTimes(
            Object.entries(ThumbnailSizeFormat).length * 2 + 2,
          );

          // check file properties
          // TODO: more precise check
          for (const item of newItems) {
            expect(item?.extra[FILE_ITEM_TYPE]).toBeTruthy();
          }
          // a membership is created for this item
          const memberships = await itemMembershipRawRepository.findBy({
            item: { id: In(items.map((i) => i.id)) },
          });
          for (const m of memberships) {
            expect(m?.permission).toEqual(PermissionLevel.Admin);
          }
        });

        it('Upload successfully one file in parent', async () => {
          const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
          const form = createFormData();
          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload?id=${parentItem.id}`,
            payload: form,
            headers: form.getHeaders(),
          });

          // check response value
          const [newItem] = Object.values(response.json().data) as Item[];
          expect(response.statusCode).toBe(StatusCodes.OK);

          // check item exists in db
          const item = await testUtils.rawItemRepository.findOneBy({ id: newItem.id });
          expectItem(item, newItem);

          // s3 upload function: We expect on image AND the thumbnails
          expect(uploadDoneMock).toHaveBeenCalledTimes(
            Object.entries(ThumbnailSizeFormat).length + 1,
          );

          // check file properties
          // TODO: more precise check
          expect(item?.extra[FILE_ITEM_TYPE]).toBeTruthy();
          expect(item?.path).toContain(parentItem.path);

          // a membership is not created for new item because it inherits parent
          const membership = await itemMembershipRawRepository.findOneBy({
            item: { id: newItem.id },
          });
          expect(membership).toBeNull();
        });

        it('Upload several files with one .h5p file', async () => {
          const form = createFormData();
          form.append(
            'H5PFile',
            fs.createReadStream(path.resolve(__dirname, './fixtures/dummy.h5p')),
          );

          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });

          // check the response value
          expect(response.statusCode).toBe(StatusCodes.OK);
          const newItems = Object.values(response.json().data) as Item[];
          expect(newItems.length).toBe(2);

          // check that both items exist in db and that their types are correctly interpreted
          const imageItem = await testUtils.rawItemRepository.findOneBy({ id: newItems[0].id });
          expectItem(imageItem, newItems[0]);
          if (S3_FILE_ITEM_PLUGIN) {
            expect(imageItem?.type).toEqual(ItemType.S3_FILE);
          } else {
            expect(imageItem?.type).toEqual(ItemType.LOCAL_FILE);
          }

          const h5pItem = await testUtils.rawItemRepository.findOneBy({ id: newItems[1].id });
          expectItem(h5pItem, newItems[1]);
          if (S3_FILE_ITEM_PLUGIN) {
            expect(h5pItem?.type).toEqual(ItemType.S3_FILE);
          } else {
            expect(h5pItem?.type).toEqual(ItemType.LOCAL_FILE);
          }
        });

        it('Cannot upload in parent with read rights', async () => {
          const member = await saveMember();
          const { item: parentItem } = await testUtils.saveItemAndMembership({
            member: actor,
            permission: PermissionLevel.Read,
            creator: member,
          });
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
          const form = createFormData();
          const { item } = await testUtils.saveItemAndMembership({
            member: actor,
            item: {
              type: ItemType.S3_FILE,
              extra: { [ItemType.S3_FILE]: { size: DEFAULT_MAX_STORAGE + 1 } } as S3FileItemExtra,
            },
          });

          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });

          expect(response.json().errors[0]).toMatchObject(new StorageExceeded(expect.anything()));

          // check previous item still exists in db
          const items = await testUtils.rawItemRepository.findBy({ id: item.id });
          expect(items).toHaveLength(1);
        });

        it('Cannot upload empty file', async () => {
          headObjectMock.mockImplementation(async () => ({ ContentLength: 0 }));
          const form = new FormData();
          form.append(
            'myfile',
            fs.createReadStream(path.resolve(__dirname, './fixtures/emptyFile')),
          );

          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });

          expect(response.json().errors[0].message).toEqual(new UploadEmptyFileError().message);
          expect(deleteObjectMock).toHaveBeenCalled();
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
            fs.createReadStream(path.resolve(__dirname, './fixtures/emptyFile')),
          );

          const form1 = createFormData(form);

          actor = await saveMember();
          mockAuthenticate(actor);
          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form1,
            headers: form1.getHeaders(),
          });

          expect(response.statusCode).toEqual(StatusCodes.OK);
          // upload 2 files and one set of thumbnails
          expect(uploadDoneMock).toHaveBeenCalledTimes(
            Object.values(ThumbnailSizeFormat).length + 2,
          );
          expect(deleteObjectMock).toHaveBeenCalledTimes(1);

          // one empty file error
          expect(response.json().errors[0].message).toEqual(new UploadEmptyFileError().message);

          // one file has been uploaded
          expect(Object.entries(response.json().data)).toHaveLength(1);

          // check item exists in db
          const item = await testUtils.rawItemRepository.findOneBy({ type: FILE_ITEM_TYPE });
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          expect(item!.type).toEqual(ItemType.S3_FILE);
        });
        it('Gracefully fails if s3 upload throws', async () => {
          uploadDoneMock.mockImplementation(() => {
            throw new Error('putObject throws');
          });

          actor = await saveMember();
          mockAuthenticate(actor);
          const form = createFormData();

          const response = await app.inject({
            method: HttpMethod.Post,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });

          expect(response.json().errors[0]).toMatchObject(
            new UploadFileUnexpectedError(expect.anything()),
          );
        });
      });
    });
  });

  describe('GET /download', () => {
    describe('Sign out', () => {
      let item, member;

      beforeEach(async () => {
        member = await saveMember();
        ({ item } = await testUtils.saveItemAndMembership({
          item: { type: ItemType.S3_FILE },
          member,
        }));
      });

      it('Throws if signed out and item is private', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });

      it('Download public file item', async () => {
        await setItemPublic(item, member);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
        });

        expect(response.statusCode).toBe(StatusCodes.MOVED_TEMPORARILY);
        expect(response.headers.location).toBe(MOCK_SIGNED_URL);
      });
    });

    describe('Signed In', () => {
      let item;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
        ({ item } = await testUtils.saveItemAndMembership({
          item: { type: ItemType.S3_FILE },
          member: actor,
        }));
      });
      describe('Without error', () => {
        it('Redirect to file item', async () => {
          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
          });

          expect(response.statusCode).toBe(StatusCodes.MOVED_TEMPORARILY);
          expect(response.headers.location).toBe(MOCK_SIGNED_URL);
        });

        it('Return file url of item', async () => {
          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download?replyUrl=true`,
          });

          expect(response.statusCode).toBe(StatusCodes.OK);
          expect(response.body).toBe(MOCK_SIGNED_URL);
        });

        it('Cannot download without rights', async () => {
          const member = await saveMember();
          const { item: someItem } = await testUtils.saveItemAndMembership({
            member,
          });

          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${someItem.id}/download`,
          });

          expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
        });

        it('Cannot download non-file item', async () => {
          const { item: someItem } = await testUtils.saveItemAndMembership({
            member: actor,
          });

          const response = await app.inject({
            method: HttpMethod.Get,
            url: `${ITEMS_ROUTE_PREFIX}/${someItem.id}/download`,
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
    let item, actor;

    beforeEach(async () => {
      actor = await saveMember();
      mockAuthenticate(actor);
      ({ item } = await testUtils.saveItemAndMembership({
        item: { type: ItemType.S3_FILE },
        member: actor,
      }));
    });

    it('Edit name for file item', async () => {
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}`,
        payload: { name: 'newName' },
      });
      expect(response.json().name).toEqual('newName');
    });

    it('Edit file item altText', async () => {
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}`,
        payload: { extra: { [FILE_ITEM_TYPE]: { altText: 'new name' } } },
      });
      expect(response.json().extra[FILE_ITEM_TYPE].altText).toEqual('new name');
    });

    it('Edit file item maxWidth', async () => {
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}`,
        payload: { settings: { maxWidth: MaxWidth.Small } },
      });
      expect(response.json().settings.maxWidth).toEqual(MaxWidth.Small);
    });

    it('Cannot edit another file item field', async () => {
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}`,
        payload: { extra: { [FILE_ITEM_TYPE]: { size: 10 } } },
      });
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('Hooks', () => {
    beforeEach(async () => {
      actor = await saveMember();
      mockAuthenticate(actor);
    });
    describe('Delete Post Hook', () => {
      it('Do not trigger file delete if item is not a file item', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}?id=${item.id}`,
        });

        await new Promise(async (done) => {
          setTimeout(async () => {
            await expect(deleteObjectMock).not.toHaveBeenCalled();

            done(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Delete corresponding file for file item', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          item: { type: ItemType.S3_FILE },
          member: actor,
        });

        await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}?id=${item.id}`,
        });

        await new Promise(async (done) => {
          setTimeout(async () => {
            await expect(deleteObjectMock).toHaveBeenCalled();

            done(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
    });

    describe('Copy Pre Hook', () => {
      it('Stop if item is not a file item', async () => {
        const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });
        const { item } = await testUtils.saveItemAndMembership({ member: actor });
        await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/copy`,
          payload: {
            parentId: parentItem.id,
          },
        });

        await new Promise(async (done) => {
          setTimeout(async () => {
            await expect(copyObjectMock).not.toHaveBeenCalled();

            done(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
      it('Copy corresponding file for file item', async () => {
        const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });

        const { item } = await testUtils.saveItemAndMembership({
          item: { type: ItemType.S3_FILE },
          member: actor,
        });

        await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/copy?id=${item.id}`,
          payload: {
            parentId: parentItem.id,
          },
        });

        await new Promise(async (done) => {
          setTimeout(async () => {
            await expect(copyObjectMock).toHaveBeenCalled();

            const items = await testUtils.rawItemRepository.find({ where: { name: item.name } });
            expect(items).toHaveLength(2);

            expect((items[0].extra as S3FileItemExtra).s3File.path).not.toEqual(
              (items[1].extra as S3FileItemExtra).s3File.path,
            );

            done(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });

      it('Prevent copy if member storage is exceeded', async () => {
        const { item: parentItem } = await testUtils.saveItemAndMembership({ member: actor });

        const { item } = await testUtils.saveItemAndMembership({
          item: {
            type: ItemType.S3_FILE,
            extra: {
              [ItemType.S3_FILE]: {
                size: DEFAULT_MAX_STORAGE,
                name: 'name',
                mimetype: 'mimetype',
                path: 'filepath',
                content: 'content',
              },
            },
          },
          member: actor,
        });
        const itemCount = await testUtils.rawItemRepository.count();

        await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/copy?id=${item.id}`,
          payload: {
            parentId: parentItem.id,
          },
        });

        await new Promise(async (done) => {
          setTimeout(async () => {
            await expect(copyObjectMock).not.toHaveBeenCalled();
            // did not copy
            expect(await testUtils.rawItemRepository.count()).toEqual(itemCount);
            done(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });
    });
  });
});
