import { eq } from 'drizzle-orm';
import fsp from 'fs/promises';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import build, { clearDatabase, mockAuthenticate } from '../../../../../../test/app';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { isDirectChild } from '../../../../../drizzle/operations';
import { itemsRawTable } from '../../../../../drizzle/schema';
import { assertIsDefined } from '../../../../../utils/assertions';
import { H5P_LOCAL_CONFIG, H5P_PATH_PREFIX, TMP_FOLDER } from '../../../../../utils/config';
import type { H5PItem } from '../../../discrimination';
import { HtmlImportError } from '../errors';
import { H5P_FILE_DOT_EXTENSION } from './constants';
import { H5PInvalidManifestError } from './errors';
import { H5PService } from './h5p.service';
import { H5P_PACKAGES } from './test/fixtures';
import { injectH5PImport } from './test/helpers';

const H5P_TMP_FOLDER = path.join(TMP_FOLDER, 'html-packages', H5P_PATH_PREFIX ?? '');

// const listObjectsV2Mock = jest.fn(async () => console.debug('listObjectsV2'));
// const deleteObjectsMock = jest.fn(async () => console.debug('deleteObjects'));
// const copyObjectMock = jest.fn(async () => console.debug('copyObjectMock'));
// const headObjectMock = jest.fn(async () => ({ ContentLength: 10 }));
// const uploadDoneMock = jest.fn(async () => console.debug('aws s3 storage upload'));

// const MOCK_SIGNED_URL = 'signed-url';
// jest.mock('@aws-sdk/client-s3', () => {
//   return {
//     GetObjectCommand: jest.fn(),
//     NotFound: jest.fn(() => ({ name: 'NotFound' })),
//     S3: function () {
//       return {
//         copyObject: copyObjectMock,
//         deleteObjects: deleteObjectsMock,
//         headObject: headObjectMock,
//         listObjectsV2: listObjectsV2Mock,
//       };
//     },
//   };
// });
// jest.mock('@aws-sdk/s3-request-presigner', () => {
//   const getSignedUrl = jest.fn(async () => MOCK_SIGNED_URL);
//   return {
//     getSignedUrl,
//   };
// });
// jest.mock('@aws-sdk/lib-storage', () => {
//   return {
//     Upload: jest.fn().mockImplementation(() => {
//       return {
//         done: uploadDoneMock,
//       };
//     }),
//   };
// });

const buildExpectedItem = (item: H5PItem) => {
  const contentId = item.extra.h5p.contentId;

  const expectedExtra = {
    h5p: {
      contentId,
      h5pFilePath: `${contentId}/${path.basename(H5P_PACKAGES.ACCORDION.path)}`,
      contentFilePath: `${contentId}/content`,
    },
  };

  return {
    name: path.basename(H5P_PACKAGES.ACCORDION.path, H5P_FILE_DOT_EXTENSION),
    type: 'h5p',
    extra: expectedExtra,
  };
};

describe('H5P plugin', () => {
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
  });

  describe('Upload valid .h5p package', () => {
    it('returns the created item object', async () => {
      const {
        actor,
        items: [parent],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const res = await injectH5PImport(app, { parentId: parent.id });
      expect(res.statusCode).toEqual(StatusCodes.OK);

      const item = res.json();
      expect(item).toMatchObject(buildExpectedItem(item));
    });

    it('removes the temporary extraction folder', async () => {
      const {
        actor,
        items: [parent],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const res = await injectH5PImport(app, { parentId: parent.id });
      expect(res.statusCode).toEqual(StatusCodes.OK);

      const contents = await fsp.readdir(H5P_TMP_FOLDER);
      expect(contents.length).toEqual(0);
    });
  });

  describe('Hooks', () => {
    it('deletes H5P assets on item delete', async () => {
      const {
        actor,
        items: [parent],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const h5pService = resolveDependency(H5PService);
      const deletePackageSpy = jest
        .spyOn(h5pService, 'deletePackage')
        .mockImplementationOnce(async () => {
          console.debug('mock deletePackage');
        });

      // save h5p so it saves the files correctly
      const res = await injectH5PImport(app, { parentId: parent.id });
      expect(res.statusCode).toEqual(StatusCodes.OK);

      const item = res.json();
      const contentId = (item as H5PItem).extra.h5p.contentId;
      // delete item
      await app.inject({
        method: 'DELETE',
        url: `/api/items`,
        query: {
          id: [item.id],
        },
      });

      await waitForExpect(() => {
        expect(deletePackageSpy).toHaveBeenCalledWith(contentId);
      }, 5000);
    });
    it('copies H5P assets on item copy', async () => {
      const {
        actor,
        items: [parent, targetParent],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // save h5p so it saves the files correctly
      const res = await injectH5PImport(app, { parentId: parent.id });
      expect(res.statusCode).toEqual(StatusCodes.OK);
      const item = res.json();

      const h5pService = resolveDependency(H5PService);
      const copySpy = jest.spyOn(h5pService, 'copy').mockImplementationOnce(async () => {
        console.debug('mock copy');
      });

      // copy item
      await app.inject({
        method: 'POST',
        url: '/api/items/copy',
        query: {
          id: [item.id],
        },
        payload: {
          parentId: targetParent.id,
        },
      });

      await waitForExpect(async () => {
        const copiedH5P = (await db.query.itemsRawTable.findFirst({
          where: isDirectChild(itemsRawTable.path, targetParent.path),
        })) as H5PItem;
        expect(copiedH5P).toBeDefined();

        expect(copySpy).toHaveBeenCalled();
      }, 5000); // the above line ensures exists
    });
    it('copies H5P with special characters on item copy', async () => {
      const {
        actor,
        items: [parent, targetParent],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // save h5p so it saves the files correctly
      const res = await injectH5PImport(app, {
        filePath: path.resolve(__dirname, 'test/fixtures/un nom français ééé.h5p'),
        parentId: parent.id,
      });
      expect(res.statusCode).toEqual(StatusCodes.OK);
      const item = res.json();

      // copy item
      await app.inject({
        method: 'POST',
        url: '/api/items/copy',
        query: {
          id: [item.id],
        },
        payload: {
          parentId: targetParent.id,
        },
      });

      await waitForExpect(async () => {
        const copiedH5P = await db.query.itemsRawTable.findFirst({
          where: isDirectChild(itemsRawTable.path, targetParent.path),
        });
        expect(copiedH5P).toBeDefined();
      }, 5000); // the above line ensures exists
    });
  });
  describe('Regression tests', () => {
    it('accepts yearFrom as numbers', async () => {
      const {
        actor,
        items: [parent],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const res = await injectH5PImport(app, {
        filePath: H5P_PACKAGES.VALID_YEAR_AS_NUMBER.path,
        parentId: parent.id,
      });
      expect(res.statusCode).toEqual(StatusCodes.OK);
    });
  });
  describe('Error handling', () => {
    it('returns error on invalid H5P package', async () => {
      const {
        actor,
        items: [parent],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const res = await injectH5PImport(app, {
        filePath: H5P_PACKAGES.BOGUS_EMPTY.path,
        parentId: parent.id,
      });
      expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(res.json()).toEqual(new H5PInvalidManifestError('Missing h5p.json manifest file'));
    });
    it('returns error and deletes extracted files on item creation failure', async () => {
      const { storageRootPath } = H5P_LOCAL_CONFIG.local;
      const uploadPackage = jest.spyOn(resolveDependency(H5PService), 'uploadPackage');
      uploadPackage.mockImplementationOnce(() => {
        throw new Error('mock error on HTML package upload');
      });

      const {
        actor,
        items: [parent],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // count initial number of files
      const initExtractionDirContents = await fsp.readdir(H5P_TMP_FOLDER);
      const initStorageDirContents = await fsp.readdir(
        path.join(...([storageRootPath, H5P_PATH_PREFIX].filter((e) => e) as string[])),
      );
      const initExtractionNb = initExtractionDirContents.length;
      const initStorageNb = initStorageDirContents.length;

      // import h5p
      const res = await injectH5PImport(app, { parentId: parent.id });
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toEqual(new HtmlImportError());

      // should not contain the files for this request anymore
      await waitForExpect(async () => {
        const extractionDirContents = await fsp.readdir(H5P_TMP_FOLDER);
        const storageDirContents = await fsp.readdir(
          path.join(...([storageRootPath, H5P_PATH_PREFIX].filter((e) => e) as string[])),
        );
        expect(extractionDirContents.length).toEqual(initExtractionNb);
        expect(storageDirContents.length).toEqual(initStorageNb);
      }, 5000);
    });
  });

  describe('Upload valid .h5p package after previous item id', () => {
    it('save h5p item after previous item', async () => {
      const {
        actor,
        items: [parent, previousItem],
      } = await seedFromJson({
        items: [
          {
            children: [{ order: 30 }],
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const res = await injectH5PImport(app, {
        parentId: parent.id,
        previousItemId: previousItem.id,
      });
      expect(res.statusCode).toEqual(StatusCodes.OK);

      // expect order is after previous item
      const item = res.json();
      const itemWithOrder = await db.query.itemsRawTable.findFirst({
        where: eq(itemsRawTable.id, item.id),
      });
      assertIsDefined(itemWithOrder);
      assertIsDefined(previousItem.order);
      expect(itemWithOrder.order).toBeGreaterThan(previousItem.order);
    });
  });
});
