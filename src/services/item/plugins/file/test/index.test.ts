import FormData from 'form-data';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import { In } from 'typeorm';

import { HttpMethod, ItemType, PermissionLevel, S3FileItemExtra } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { MULTIPLE_ITEMS_LOADING_TIME } from '../../../../../../test/constants';
import { FILE_ITEM_TYPE, ITEMS_ROUTE_PREFIX } from '../../../../../utils/config';
import { MemberCannotAccess, MemberCannotWriteItem } from '../../../../../utils/errors';
import {
  DownloadFileInvalidParameterError,
  DownloadFileUnexpectedError,
  UploadEmptyFileError,
  UploadFileUnexpectedError,
} from '../../../../file/utils/errors';
import { expectItem, expectManyItems, getDummyItem } from '../../../../item/test/fixtures/items';
import { ItemMembershipRepository } from '../../../../itemMembership/repository';
import { saveItemAndMembership } from '../../../../itemMembership/test/fixtures/memberships';
import { BOB, saveMember } from '../../../../member/test/fixtures/members';
import { ThumbnailSizeFormat } from '../../../../thumbnail/constants';
import { Item } from '../../../entities/Item';
import { ItemRepository } from '../../../repository';
import { setItemPublic } from '../../itemTag/test/fixtures';
import { DEFAULT_MAX_STORAGE } from '../utils/constants';
import { StorageExceeded } from '../utils/errors';

// TODO: LOCAL FILE TESTS

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

const MOCK_FILE_ITEM = getDummyItem({
  type: FILE_ITEM_TYPE,
  extra: {
    [FILE_ITEM_TYPE]: {
      name: 'name',
      mimetype: 'mimetype',
      path: 'filepath',
      size: 10,
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

const MOCK_HUGE_FILE_ITEM = getDummyItem({
  type: FILE_ITEM_TYPE,
  extra: {
    [FILE_ITEM_TYPE]: {
      name: 'name',
      mimetype: 'mimetype',
      path: 'filepath',
      size: DEFAULT_MAX_STORAGE,
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any);

// we need a different form data for each test
const createFormData = (form = new FormData()) => {
  form.append('myfile', fs.createReadStream(path.resolve(__dirname, './fixtures/image.png')));

  return form;
};

describe('File Item routes tests', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('POST /upload', () => {
    it('Throws if signed out', async () => {
      const form = createFormData();
      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/items/upload',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      describe('Without error', () => {
        beforeEach(async () => {
          ({ app, actor } = await build());
        });

        it('Upload successfully one file', async () => {
          const form = createFormData();

          const response = await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });
          // check response value
          const [newItem] = Object.values(response.json().data) as Item[];
          expect(response.statusCode).toBe(StatusCodes.OK);

          // check item exists in db
          const item = await ItemRepository.findOneBy({ type: FILE_ITEM_TYPE });
          expectItem(item, newItem);

          // s3 upload function: We expect on image AND the thumbnails
          expect(uploadDoneMock).toHaveBeenCalledTimes(
            Object.entries(ThumbnailSizeFormat).length + 1,
          );

          // check file properties
          // TODO: more precise check
          expect(item?.extra[FILE_ITEM_TYPE]).toBeTruthy();

          // a membership is created for this item
          const membership = await ItemMembershipRepository.findOneBy({ item: { id: newItem.id } });
          expect(membership?.permission).toEqual(PermissionLevel.Admin);
        });

        it('Upload successfully many files', async () => {
          const form = createFormData();
          const form1 = createFormData(form);

          const response = await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form1,
            headers: form1.getHeaders(),
          });

          // check response value
          const items = Object.values(response.json().data) as Item[];
          expect(response.statusCode).toBe(StatusCodes.OK);

          // check item exists in db
          const newItems = await ItemRepository.findBy({ type: FILE_ITEM_TYPE });
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
          const memberships = await ItemMembershipRepository.findBy({
            item: { id: In(items.map((i) => i.id)) },
          });
          for (const m of memberships) {
            expect(m?.permission).toEqual(PermissionLevel.Admin);
          }
        });

        it('Upload successfully one file in parent', async () => {
          const { item: parentItem } = await saveItemAndMembership({ member: actor });
          const form = createFormData();
          const response = await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/upload?id=${parentItem.id}`,
            payload: form,
            headers: form.getHeaders(),
          });

          // check response value
          const [newItem] = Object.values(response.json().data) as Item[];
          expect(response.statusCode).toBe(StatusCodes.OK);

          // check item exists in db
          const item = await ItemRepository.findOneBy({ type: FILE_ITEM_TYPE });
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
          const membership = await ItemMembershipRepository.findOneBy({ item: { id: newItem.id } });
          expect(membership).toBeNull();
        });

        it('Cannot upload in parent with read rights', async () => {
          const member = await saveMember(BOB);
          const { item: parentItem } = await saveItemAndMembership({
            member: actor,
            permission: PermissionLevel.Read,
            creator: member,
          });
          const form = createFormData();

          const response = await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/upload?id=${parentItem.id}`,
            payload: form,
            headers: form.getHeaders(),
          });

          expect(response.json()).toMatchObject(new MemberCannotWriteItem(expect.anything()));

          // check item exists in db
          const item = await ItemRepository.findOneBy({ type: FILE_ITEM_TYPE });
          expect(item).toBeNull();

          // s3 upload function
          expect(uploadDoneMock).not.toHaveBeenCalled();
        });

        it('Cannot upload with storage exceeded', async () => {
          const form = createFormData();
          await saveItemAndMembership({
            member: actor,
            item: getDummyItem({
              type: ItemType.S3_FILE,
              extra: { [ItemType.S3_FILE]: { size: DEFAULT_MAX_STORAGE + 1 } } as S3FileItemExtra,
            }),
          });

          const response = await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });

          expect(response.json().errors[0]).toMatchObject(new StorageExceeded(expect.anything()));

          // check item exists in db
          const items = await ItemRepository.findBy({ type: FILE_ITEM_TYPE });
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
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });

          expect(response.json().errors[0].message).toEqual(new UploadEmptyFileError().message);
          expect(deleteObjectMock).toHaveBeenCalled();

          // check item exists in db
          const item = await ItemRepository.findOneBy({ type: FILE_ITEM_TYPE });
          expect(item).toBeNull();
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

          ({ app, actor } = await build());
          const response = await app.inject({
            method: HttpMethod.POST,
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
          const item = await ItemRepository.findOneBy({ type: FILE_ITEM_TYPE });
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          expect(item!.type).toEqual(ItemType.S3_FILE);
        });
        it('Gracefully fails if s3 upload throws', async () => {
          uploadDoneMock.mockImplementation(() => {
            throw new Error('putObject throws');
          });

          ({ app, actor } = await build());
          const form = createFormData();

          const response = await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/upload`,
            payload: form,
            headers: form.getHeaders(),
          });

          expect(response.json().errors[0]).toMatchObject(
            new UploadFileUnexpectedError(expect.anything()),
          );

          // check item exists in db
          const item = await ItemRepository.findOneBy({ type: FILE_ITEM_TYPE });
          expect(item).toBeNull();
        });
      });
    });
  });

  describe('GET /download', () => {
    describe('Sign out', () => {
      let item, member;

      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ item: MOCK_FILE_ITEM, member }));
      });

      it('Throws if signed out and item is private', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });

      it('Download public file item', async () => {
        await setItemPublic(item, member);

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
        });

        expect(response.statusCode).toBe(StatusCodes.MOVED_TEMPORARILY);
        expect(response.headers.location).toBe(MOCK_SIGNED_URL);
      });
    });

    describe('Signed In', () => {
      let item;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await saveItemAndMembership({ item: MOCK_FILE_ITEM, member: actor }));
      });
      describe('Without error', () => {
        it('Redirect to file item', async () => {
          const response = await app.inject({
            method: HttpMethod.GET,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
          });

          expect(response.statusCode).toBe(StatusCodes.MOVED_TEMPORARILY);
          expect(response.headers.location).toBe(MOCK_SIGNED_URL);
        });

        it('Return file url of item', async () => {
          const response = await app.inject({
            method: HttpMethod.GET,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download?replyUrl=true`,
          });

          expect(response.statusCode).toBe(StatusCodes.OK);
          expect(response.body).toBe(MOCK_SIGNED_URL);
        });

        it('Cannot download without rights', async () => {
          const member = await saveMember(BOB);
          const { item: someItem } = await saveItemAndMembership({
            member,
          });

          const response = await app.inject({
            method: HttpMethod.GET,
            url: `${ITEMS_ROUTE_PREFIX}/${someItem.id}/download`,
          });

          expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
        });

        it('Cannot download non-file item', async () => {
          const { item: someItem } = await saveItemAndMembership({
            member: actor,
          });

          const response = await app.inject({
            method: HttpMethod.GET,
            url: `${ITEMS_ROUTE_PREFIX}/${someItem.id}/download`,
          });

          expect(response.json()).toMatchObject(
            new DownloadFileInvalidParameterError(expect.anything()),
          );
        });
      });

      describe('With error', () => {
        it('Gracefully fails if s3 headObject throws', async () => {
          headObjectMock.mockImplementation(() => {
            throw new Error('headObject throws');
          });

          const response = await app.inject({
            method: HttpMethod.GET,
            url: `${ITEMS_ROUTE_PREFIX}/${item.id}/download`,
          });

          // we want the download file to wrap the error
          expect(response.json()).toMatchObject(new DownloadFileUnexpectedError(expect.anything()));
        });
      });
    });
  });

  describe('Edit file - PATCH /items/id', () => {
    let item, actor;

    beforeEach(async () => {
      ({ app, actor } = await build());
      ({ item } = await saveItemAndMembership({ item: MOCK_FILE_ITEM, member: actor }));
    });

    it('Edit file item altText', async () => {
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}`,
        payload: { extra: { [FILE_ITEM_TYPE]: { altText: 'new name' } } },
      });
      expect(response.json().extra[FILE_ITEM_TYPE].altText).toEqual('new name');
    });

    it('Cannot edit another file item field', async () => {
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}`,
        payload: { extra: { [FILE_ITEM_TYPE]: { size: 10 } } },
      });
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('Hooks', () => {
    beforeEach(async () => {
      ({ app, actor } = await build());
    });
    describe('Delete Post Hook', () => {
      it('Do not trigger file delete if item is not a file item', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        await app.inject({
          method: HttpMethod.DELETE,
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
        const { item } = await saveItemAndMembership({ item: MOCK_FILE_ITEM, member: actor });

        await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}?id=${item.id}`,
        });

        await new Promise(async (done) => {
          setTimeout(async () => {
            await expect(deleteObjectMock).toHaveBeenCalled();

            done(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });

      describe('Copy Pre Hook', () => {
        it('Stop if item is not a file item', async () => {
          const { item: parentItem } = await saveItemAndMembership({ member: actor });
          const { item } = await saveItemAndMembership({ member: actor });
          await app.inject({
            method: HttpMethod.POST,
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
          const { item: parentItem } = await saveItemAndMembership({ member: actor });

          const { item } = await saveItemAndMembership({ item: MOCK_FILE_ITEM, member: actor });

          await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/copy?id=${item.id}`,
            payload: {
              parentId: parentItem.id,
            },
          });

          await new Promise(async (done) => {
            setTimeout(async () => {
              await expect(copyObjectMock).toHaveBeenCalled();

              const items = await ItemRepository.find({ where: { name: item.name } });
              expect(items).toHaveLength(2);
              expect((items[0].extra as S3FileItemExtra).s3File.path).not.toEqual(
                (items[1].extra as S3FileItemExtra).s3File.path,
              );

              done(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });

        it('Prevent copy if member storage is exceeded', async () => {
          const { item: parentItem } = await saveItemAndMembership({ member: actor });

          const { item } = await saveItemAndMembership({
            item: MOCK_HUGE_FILE_ITEM,
            member: actor,
          });
          const itemCount = await ItemRepository.find();

          await app.inject({
            method: HttpMethod.POST,
            url: `${ITEMS_ROUTE_PREFIX}/copy?id=${item.id}`,
            payload: {
              parentId: parentItem.id,
            },
          });

          await new Promise(async (done) => {
            setTimeout(async () => {
              await expect(copyObjectMock).not.toHaveBeenCalled();
              // did not copy
              expect(await ItemRepository.find()).toHaveLength(itemCount.length);
              done(true);
            }, MULTIPLE_ITEMS_LOADING_TIME);
          });
        });
      });
    });
  });
});
