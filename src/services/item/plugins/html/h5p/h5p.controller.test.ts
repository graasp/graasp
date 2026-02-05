import { type Options, compare as dircompare, fileCompareHandlers } from 'dir-compare';
import { eq } from 'drizzle-orm';
import fs from 'fs';
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
import { expectH5PFiles, injectH5PImport } from './test/helpers';

const H5P_TMP_FOLDER = path.join(TMP_FOLDER, 'html-packages', H5P_PATH_PREFIX ?? '');

async function cleanFiles() {
  const storage = path.join(H5P_LOCAL_CONFIG.local.storageRootPath, H5P_PATH_PREFIX ?? '');
  await fsp.rm(storage, { recursive: true, force: true });
  await fsp.rm(H5P_TMP_FOLDER, { recursive: true, force: true });
}

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

describe('Service plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    await cleanFiles();
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

    it('extracts the files correctly', async () => {
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
      const { contentId } = item.extra.h5p;
      const { storageRootPath } = H5P_LOCAL_CONFIG.local;
      await expectH5PFiles(H5P_PACKAGES.ACCORDION, storageRootPath, H5P_PATH_PREFIX, contentId);
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
      // H5P folder should now be deleted
      const h5pFolder = path.join(
        ...([H5P_LOCAL_CONFIG.local.storageRootPath, H5P_PATH_PREFIX, contentId].filter(
          (e) => e,
        ) as string[]),
      );
      await waitForExpect(() => {
        expect(fs.existsSync(h5pFolder)).toBeFalsy();
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

      const contentId = (item as H5PItem).extra.h5p.contentId;
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
      // H5P folder should now be copied
      const h5pBucket = path.join(
        ...([H5P_LOCAL_CONFIG.local.storageRootPath, H5P_PATH_PREFIX].filter((e) => e) as string[]),
      );

      let copiedH5P: H5PItem;
      await waitForExpect(async () => {
        copiedH5P = (await db.query.itemsRawTable.findFirst({
          where: isDirectChild(itemsRawTable.path, targetParent.path),
        })) as H5PItem;
        expect(copiedH5P).toBeDefined();
      }, 5000); // the above line ensures exists

      await waitForExpect(async () => {
        // wait for copied folder to exist
        const h5pFolders = await fsp.readdir(h5pBucket);
        const copiedContentId = copiedH5P.extra.h5p.contentId;
        expect(h5pFolders).toContain(copiedContentId);
        // expected name of the copy
        const H5P_ACCORDION_COPY_FILENAME = `${path.basename(
          H5P_PACKAGES.ACCORDION.path,
          H5P_FILE_DOT_EXTENSION,
        )}-1`;
        const originalPath = path.join(
          h5pBucket,
          contentId,
          path.basename(H5P_PACKAGES.ACCORDION.path),
        );
        const copyPath = path.join(h5pBucket, copiedContentId, H5P_ACCORDION_COPY_FILENAME);
        const originalStats = await fsp.stat(originalPath);
        const copyStats = await fsp.stat(copyPath);
        const defaultFileCompare = fileCompareHandlers.defaultFileCompare.compareAsync;

        const customFileCompare = (
          path1: string,
          stat1: fs.Stats,
          path2: string,
          stat2: fs.Stats,
          options: Options,
        ) => {
          if (path1 === originalPath) {
            return defaultFileCompare(path1, stat1, copyPath, copyStats, options);
          } else if (path2 === originalPath) {
            return defaultFileCompare(copyPath, copyStats, path2, stat2, options);
          } else if (path1 === copyPath) {
            return defaultFileCompare(path1, stat1, originalPath, originalStats, options);
          } else if (path2 === copyPath) {
            return defaultFileCompare(originalPath, originalStats, path2, stat2, options);
          } else {
            return defaultFileCompare(path1, stat1, path2, stat2, options);
          }
        };
        const dirDiff = await dircompare(originalPath, copyPath, {
          compareContent: true,
          compareFileAsync: customFileCompare,
        });
        expect(dirDiff.same).toBeTruthy();
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
    it('skips invalid file extensions', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const res = await injectH5PImport(app, {
        filePath: H5P_PACKAGES.BOGUS_WRONG_EXTENSION.path,
      });
      const item = res.json();
      const contentId = item.extra.h5p.contentId;
      const { storageRootPath } = H5P_LOCAL_CONFIG.local;
      await expectH5PFiles(
        H5P_PACKAGES.BOGUS_WRONG_EXTENSION,
        storageRootPath,
        H5P_PATH_PREFIX,
        contentId,
      );
      const maliciousFolder = path.join(
        ...[storageRootPath, H5P_PATH_PREFIX, contentId, 'content', 'foo'].filter((e) => e),
      );
      expect(fs.existsSync(maliciousFolder)).toBeTruthy();
      // only .txt should be left inside
      const contents = await fsp.readdir(maliciousFolder);
      expect(contents.length).toEqual(1);
      expect(contents.includes('valid.txt')).toBeTruthy();
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
