import { Options, compare as dircompare, fileCompareHandlers } from 'dir-compare';
import fs from 'fs';
import fsp from 'fs/promises';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance, LightMyRequestResponse } from 'fastify';

import { H5PItemExtra, H5PItemType, ItemType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../../test/app';
import { resolveDependency } from '../../../../../../di/utils';
import { H5P_LOCAL_CONFIG, H5P_PATH_PREFIX, TMP_FOLDER } from '../../../../../../utils/config';
import { Actor } from '../../../../../member/entities/member';
import { Item, ItemTypeEnumKeys } from '../../../../entities/Item';
import { ItemService } from '../../../../service';
import { ItemTestUtils } from '../../../../test/fixtures/items';
import { HtmlImportError } from '../../errors';
import { H5P_FILE_DOT_EXTENSION } from '../constants';
import { H5PInvalidManifestError } from '../errors';
import { H5P_PACKAGES } from './fixtures';
import { expectH5PFiles, injectH5PImport } from './helpers';

const H5P_ACCORDION_FILENAME = path.basename(H5P_PACKAGES.ACCORDION.path);

const testUtils = new ItemTestUtils();

const H5P_TMP_FOLDER = path.join(TMP_FOLDER, 'html-packages', H5P_PATH_PREFIX || '');

async function cleanFiles() {
  const storage = path.join(H5P_LOCAL_CONFIG.local.storageRootPath, H5P_PATH_PREFIX || '');
  await fsp.rm(storage, { recursive: true, force: true });
  await fsp.rm(H5P_TMP_FOLDER, { recursive: true, force: true });
}

describe('Service plugin', () => {
  let app: FastifyInstance;
  let member: Actor;
  let parent: Item;

  let res: LightMyRequestResponse,
    item: H5PItemType,
    contentId: string,
    expectedExtra: H5PItemExtra,
    expectedMetadata: Partial<H5PItemType>;

  beforeEach(async () => {
    ({ app, actor: member } = await build());
    if (!member) {
      throw new Error('Test member not defined');
    }
    ({ item: parent } = await testUtils.saveItemAndMembership({ member }));
    res = await injectH5PImport(app, { parentId: parent.id });
    item = res.json();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    await cleanFiles();
    app.close();
  });

  describe('Upload valid .h5p package', () => {
    beforeEach(async () => {
      // contentId is generated by the server so we have to retrieve it from response
      contentId = item.extra.h5p.contentId;

      expectedExtra = {
        h5p: {
          contentId,
          h5pFilePath: `${contentId}/${H5P_ACCORDION_FILENAME}`,
          contentFilePath: `${contentId}/content`,
        },
      };

      expectedMetadata = {
        name: H5P_ACCORDION_FILENAME,
        type: ItemType.H5P,
        extra: expectedExtra,
      };
    });

    it('returns the created item object', () => {
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(item).toMatchObject({
        ...expectedMetadata,
      });
    });

    it('extracts the files correctly', async () => {
      const { storageRootPath } = H5P_LOCAL_CONFIG.local;
      await expectH5PFiles(H5P_PACKAGES.ACCORDION, storageRootPath, H5P_PATH_PREFIX, contentId);
    });

    it('removes the temporary extraction folder', async () => {
      const contents = await fsp.readdir(H5P_TMP_FOLDER);
      expect(contents.length).toEqual(0);
    });
  });

  describe('Hooks', () => {
    it('deletes H5P assets on item delete', async () => {
      const contentId = item.extra.h5p.contentId;

      // delete item
      await app.inject({
        method: 'DELETE',
        url: `/items/`,
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
      const contentId = item.extra.h5p.contentId;

      // copy item
      await app.inject({
        method: 'POST',
        url: 'items/copy',
        query: {
          id: [item.id],
        },
        payload: {
          parentId: parent.id,
        },
      });

      // H5P folder should now be copied
      const h5pBucket = path.join(
        ...([H5P_LOCAL_CONFIG.local.storageRootPath, H5P_PATH_PREFIX].filter((e) => e) as string[]),
      );
      let h5pFolders;
      let itemsInDb;
      await waitForExpect(async () => {
        itemsInDb = await testUtils.rawItemRepository.find({
          where: {
            type: item.type as ItemTypeEnumKeys,
          },
        });
        expect(itemsInDb.length).toEqual(2);
        h5pFolders = await fsp.readdir(h5pBucket);
        expect(h5pFolders.length).toEqual(2);
        expect(h5pFolders.includes(contentId));
      }, 5000);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const otherId = h5pFolders.find((e) => e !== contentId)!; // the above line ensures exists

      // expected name of the copy
      const H5P_ACCORDION_COPY_FILENAME = `${path.basename(
        H5P_ACCORDION_FILENAME,
        H5P_FILE_DOT_EXTENSION,
      )}-1${H5P_FILE_DOT_EXTENSION}`;
      const originalPath = path.join(h5pBucket, contentId, H5P_ACCORDION_FILENAME);
      const copyPath = path.join(h5pBucket, otherId, H5P_ACCORDION_COPY_FILENAME);
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
    });
  });

  describe('Regression tests', () => {
    it('accepts yearFrom as numbers', async () => {
      const res = await injectH5PImport(app, {
        filePath: H5P_PACKAGES.VALID_YEAR_AS_NUMBER.path,
        parentId: parent.id,
      });
      expect(res.statusCode).toEqual(StatusCodes.OK);
    });
  });

  describe('Error handling', () => {
    it('returns error on invalid H5P package', async () => {
      const res = await injectH5PImport(app, {
        filePath: H5P_PACKAGES.BOGUS_EMPTY.path,
        parentId: parent.id,
      });
      expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(res.json()).toEqual(new H5PInvalidManifestError('Missing h5p.json manifest file'));
    });

    it('returns error and deletes extracted files on item creation failure', async () => {
      const createItem = jest.spyOn(resolveDependency(ItemService), 'post');
      createItem.mockImplementationOnce(() => {
        throw new Error('mock error');
      });

      const res = await injectH5PImport(app, { parentId: parent.id });
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toEqual(new HtmlImportError());

      const { storageRootPath } = H5P_LOCAL_CONFIG.local;
      waitForExpect(async () => {
        const extractionDirContents = await fsp.readdir(H5P_TMP_FOLDER);
        const storageDirContents = await fsp.readdir(
          path.join(...([storageRootPath, H5P_PATH_PREFIX].filter((e) => e) as string[])),
        );
        expect(extractionDirContents.length).toEqual(0);
        expect(storageDirContents.length).toEqual(0);
      }, 5000);
    });

    it('skips invalid file extensions', async () => {
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
});

describe('Upload valid .h5p package after previous item id', () => {
  let previousItem: Item;
  let app: FastifyInstance;
  let member: Actor;
  let parent: Item;

  let res: LightMyRequestResponse,
    item: H5PItemType,
    contentId: string,
    expectedExtra: H5PItemExtra,
    expectedMetadata: Partial<H5PItemType>;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    await cleanFiles();
    app.close();
  });

  beforeEach(async () => {
    ({ app, actor: member } = await build());
    if (!member) {
      throw new Error('Test member not defined');
    }
    ({ item: parent } = await testUtils.saveItemAndMembership({ member }));
    previousItem = await testUtils.saveItem({ parentItem: parent });
    res = await injectH5PImport(app, { parentId: parent.id, previousItemId: previousItem.id });
    item = res.json();

    // contentId is generated by the server so we have to retrieve it from response
    contentId = item.extra.h5p.contentId;

    expectedExtra = {
      h5p: {
        contentId,
        h5pFilePath: `${contentId}/${H5P_ACCORDION_FILENAME}`,
        contentFilePath: `${contentId}/content`,
      },
    };

    expectedMetadata = {
      name: H5P_ACCORDION_FILENAME,
      type: ItemType.H5P,
      extra: expectedExtra,
    };
  });

  it('saved item at correct position', async () => {
    expect(res.statusCode).toEqual(StatusCodes.OK);
    expect(item).toMatchObject({
      ...expectedMetadata,
    });

    await testUtils.expectOrder(item.id, previousItem.id);
  });
});
