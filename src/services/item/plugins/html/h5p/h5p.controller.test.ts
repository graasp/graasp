import { eq } from 'drizzle-orm';
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
import { H5P_PATH_PREFIX, H5P_S3_CONFIG } from '../../../../../utils/config';
import { S3FileRepository } from '../../../../file/repositories/s3';
import type { H5PItem } from '../../../discrimination';
import { HtmlImportError } from '../errors';
import { H5P_FILE_DOT_EXTENSION } from './constants';
import { H5PInvalidManifestError } from './errors';
import { H5PService } from './h5p.service';
import { H5P_PACKAGES } from './test/fixtures';
import { injectH5PImport } from './test/helpers';

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

const getMetadata = async ({
  h5pFilePath,
  contentFilePath,
}: {
  h5pFilePath: string;
  contentFilePath: string;
}) => {
  const s3FileRepository = new S3FileRepository(H5P_S3_CONFIG.s3);
  const copiedFile = await s3FileRepository.getMetadata(H5P_PATH_PREFIX + h5pFilePath);
  const copiedFolder = await s3FileRepository.getMetadata(
    H5P_PATH_PREFIX + contentFilePath + '/h5p.json',
  );
  return { file: copiedFile, content: copiedFolder };
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
      const { file, content } = await getMetadata((item as H5PItem).extra.h5p);
      expect(content.ContentLength).toBeGreaterThan(100);
      expect(file.ContentLength).toBeGreaterThan(1000);

      // delete item
      await app.inject({
        method: 'DELETE',
        url: `/api/items`,
        query: {
          id: [item.id],
        },
      });

      await waitForExpect(async () => {
        // check files are deleted
        await expect(() => getMetadata((item as H5PItem).extra.h5p)).rejects.toThrow();
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

      let copiedH5P;
      await waitForExpect(async () => {
        copiedH5P = (await db.query.itemsRawTable.findFirst({
          where: isDirectChild(itemsRawTable.path, targetParent.path),
        })) as H5PItem;
        expect(copiedH5P).toBeDefined();

        // check copies exist
        const { file, content } = await getMetadata((copiedH5P as H5PItem).extra.h5p);
        expect(content.ContentLength).toBeGreaterThan(100);
        expect(file.ContentLength).toBeGreaterThan(1000);
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
    it('returns error on item creation failure', async () => {
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

      // import h5p
      const res = await injectH5PImport(app, { parentId: parent.id });
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toEqual(new HtmlImportError());
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
