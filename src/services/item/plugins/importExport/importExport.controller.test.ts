import { Queue } from 'bullmq';
import { and, asc, eq, ne } from 'drizzle-orm';
import FormData, { Readable } from 'form-data';
import fs from 'fs';
import { readFile } from 'fs/promises';
import { StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';
import path from 'path';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import {
  type FileItemProperties,
  HttpMethod,
  ItemType,
  MimeTypes,
  ThumbnailSize,
} from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { ItemFactory } from '../../../../../test/factories/item.factory';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { REDIS_CONNECTION } from '../../../../config/redis';
import { db } from '../../../../drizzle/db';
import { isDescendantOrSelf, isDirectChild } from '../../../../drizzle/operations';
import { appSettingsTable, itemsRawTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX, THUMBNAILS_ROUTE_PREFIX } from '../../../../utils/config';
import { Queues } from '../../../../workers/config';
import { LocalFileRepository } from '../../../file/repositories/local';
import { GRAASP_MANIFEST_FILENAME } from './constants';
import { GraaspExportItem } from './import.service';
import * as ARCHIVE_CONTENT from './test/fixtures/archive';
import { prepareZip } from './utils';

// note: some tests are flacky
jest.retryTimes(3, { logErrorsBeforeRetry: true });

const getItemByName = async (itemName: string) => {
  return await db.query.itemsRawTable.findFirst({
    where: eq(itemsRawTable.name, itemName),
  });
};

// we need a different form data for each test
const createFormData = (filename: string) => {
  const form = new FormData();
  form.append(
    'myfile',
    fs.createReadStream(path.resolve(__dirname, `./test/fixtures/${filename}`)),
  );

  return form;
};

const readResponseStream = async (stream: Readable) => {
  const { folderPath, targetFolder } = await prepareZip(stream);

  const manifestString = await readFile(path.join(folderPath, GRAASP_MANIFEST_FILENAME), {
    encoding: 'utf8',
    flag: 'r',
  });

  const manifestItems: GraaspExportItem[] = JSON.parse(manifestString);

  return {
    targetFolder,
    manifestItems,
  };
};

const setupActorAndItems = async () => {
  const secondLevelChildren = Array.from({ length: 5 }).map((_val, i) => {
    return {
      name: `secondLevelItem${i}`,
      order: i,
    };
  });
  const appItem = {
    type: ItemType.APP,
    name: `secondLevelItemApp`,
    appSettings: [{ creator: { name: 'bob' }, name: 'app-setting' }],
  };
  const firstLevelChildren = Array.from({ length: 15 }).map((_val, i) => {
    if (i === 0) {
      return {
        name: `folderItem1`,
        type: ItemType.FOLDER,
        order: i,
        children: [...secondLevelChildren, appItem],
      };
    }
    return {
      name: `firstLevelItem${i}`,
      order: i,
    };
  });

  const { actor, items } = await seedFromJson({
    actor: {},
    items: [
      {
        name: 'folderItem',
        type: ItemType.FOLDER,
        memberships: [{ account: `actor` }],
        children: firstLevelChildren,
      },
    ],
  });

  const folderItem = items.find((i) => i.name === 'folderItem')!;
  const firstLevelFolderItem = items.find((i) => i.name === 'folderItem1')!;
  const firstLevelItems = items.filter((i) => i.name.startsWith('firstLevelItem'))!;
  firstLevelItems.unshift(firstLevelFolderItem);
  const secondLevelItems = items.filter((i) => i.name.startsWith('secondLevelItem'))!;

  return {
    actor,
    items,
    folderItem,
    firstLevelFolderItem,
    firstLevelItems,
    secondLevelItems,
    appItem,
  };
};

jest.mock('node-fetch');

const uploadDoneMock = jest.fn(async () => console.debug('aws s3 storage upload'));
const deleteObjectMock = jest.fn(async () => console.debug('deleteObjectMock'));
const copyObjectMock = jest.fn(async () => console.debug('copyObjectMock'));
const headObjectMock = jest.fn(async () => ({ ContentLength: 10 }));
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

const iframelyMeta = {
  title: ARCHIVE_CONTENT.link.name,
  description: ARCHIVE_CONTENT.link.extra.embeddedLink.description,
};

const iframelyResult = {
  meta: iframelyMeta,
  html: 'html',
  icons: [],
  thumbnails: [],
};

const importExportQueue = new Queue(Queues.ItemExport.queueName, {
  connection: { url: REDIS_CONNECTION },
});

describe('ZIP routes tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
    // clear the jobs from the queue
    importExportQueue.drain(true);
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
    await importExportQueue.close();
  });

  beforeEach(() => {
    (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { json: async () => iframelyResult } as any;
    });
  });

  afterEach(async () => {
    unmockAuthenticate();
    jest.clearAllMocks();
  });

  describe('POST /api/zip-import', () => {
    it('Import successfully at root if signed in', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const form = createFormData('archive.zip');

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/zip-import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        // get actor's root items
        const rootItemResponse = await app.inject({
          method: HttpMethod.Get,
          url: '/api/items/accessible',
        });
        const rootItems = rootItemResponse.json().data;
        expect(rootItems).toHaveLength(7);

        // get one imported child in folder
        const parent = rootItems.find(({ name }) => name === ARCHIVE_CONTENT.folder.name);
        const itemsResponse = await app.inject({
          method: HttpMethod.Get,
          url: `/api/items/${parent.id}/children`,
        });
        const children = itemsResponse.json();
        expect(children).toHaveLength(1);

        const items = [...rootItems, ...children];

        for (const file of ARCHIVE_CONTENT.archive) {
          const item = items.find(({ name }) => name === file.name);
          if (!item) {
            throw new Error('item was not created');
          }
          expect(item.type).toEqual(file.type);
          expect(item.description).toContain(file.description);
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          expect(item.creator!.id).toEqual(actor.id);

          if (item.type === ItemType.FILE) {
            expect((item.extra[ItemType.FILE] as { name: string }).name).toEqual(
              (file.extra[ItemType.FILE] as { name: string }).name,
            );
          } else if (item.type === ItemType.LINK) {
            expect((item.extra[ItemType.LINK] as { url: string }).url).toEqual(
              (file.extra[ItemType.LINK] as { url: string }).url,
            );
          } else if (item.type === ItemType.FOLDER) {
            // loosely check the
            expect(item.extra).toEqual({ [ItemType.FOLDER]: {} });
          } else {
            expect(item.extra).toEqual(file.extra);
          }
        }

        const child = await getItemByName(ARCHIVE_CONTENT.childContent.name);
        const folderItem = await getItemByName(ARCHIVE_CONTENT.folder.name);
        assertIsDefined(folderItem);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(child!.path).toContain(folderItem.path);
      }, 5000);
    });
    // This test is flacky
    it('Import successfully in folder if signed in', async () => {
      const {
        actor,
        items: [parentItem],
      } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const form = createFormData('archive.zip');

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/zip-import',
        payload: form,
        query: { parentId: parentItem.id },
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const items = await db.query.itemsRawTable.findMany({
          where: and(
            isDescendantOrSelf(itemsRawTable.path, parentItem.path),
            ne(itemsRawTable.id, parentItem.id),
          ),
        });
        expect(items).toHaveLength(8);

        for (const file of ARCHIVE_CONTENT.archive) {
          const item = items.find(({ name }) => name === file.name);
          if (!item) {
            throw new Error('item was not created');
          }
          expect(item.type).toEqual(file.type);
          expect(item.description).toContain(file.description);
          expect(item.creatorId).toEqual(actor.id);

          if (item.type === ItemType.FILE) {
            expect((item.extra[ItemType.FILE] as { name: string }).name).toEqual(
              (file.extra[ItemType.FILE] as { name: string }).name,
            );
          } else if (item.type === ItemType.LINK) {
            expect((item.extra[ItemType.LINK] as { url: string }).url).toEqual(
              (file.extra[ItemType.LINK] as { url: string }).url,
            );
          } else if (item.type === ItemType.FOLDER) {
            // loosely check the
            expect(item.extra).toEqual({ [ItemType.FOLDER]: {} });
          } else {
            expect(item.extra).toEqual(file.extra);
          }
        }

        const folderItem = await getItemByName(ARCHIVE_CONTENT.folder.name);
        const child = await db.query.itemsRawTable.findFirst({
          where: and(
            eq(itemsRawTable.name, ARCHIVE_CONTENT.childContent.name),
            isDirectChild(itemsRawTable.path, folderItem!.path),
          ),
        });
        expect(child).toBeDefined();
      }, 5000);
    });
    it('Import archive in folder with empty folder', async () => {
      const {
        actor,
        items: [parentItem],
      } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const form = createFormData('empty.zip');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/zip-import',
        payload: form,
        headers: form.getHeaders(),
        query: { parentId: parentItem.id },
      });

      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const items = await db.query.itemsRawTable.findMany({
          where: and(
            isDescendantOrSelf(itemsRawTable.path, parentItem.path),
            ne(itemsRawTable.id, parentItem.id),
          ),
        });
        expect(items).toHaveLength(1);
      }, 1000);
    });
    it('Import in folder and sanitize html, txt and description', async () => {
      const {
        actor,
        items: [parentItem],
      } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const form = createFormData('htmlAndText.zip');
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/zip-import',
        payload: form,
        headers: form.getHeaders(),
        query: { parentId: parentItem.id },
      });

      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const items = await db.query.itemsRawTable.findMany({
          where: and(
            isDescendantOrSelf(itemsRawTable.path, parentItem.path),
            ne(itemsRawTable.id, parentItem.id),
          ),
        });
        expect(items).toHaveLength(2);

        for (const item of items) {
          // .txt + description
          if (item.name === 'mytext') {
            // allowed tags
            expect(item.description).toContain(`<h1>My First Heading</h1>`);
            expect(item.description).toContain(`<p>My first paragraph.</p>`);

            // the script with a console should not appear in the text
            expect(item.description).not.toContain(`script`);
            expect(item.description).not.toContain(`console`);

            // content
            expect(item.extra[ItemType.DOCUMENT].content).toEqual('This is a txt content');
          }
          // .html
          else if (item.name === 'myhtml') {
            // description
            expect(item.description).toEqual('');

            // allowed tags
            expect(item.extra[ItemType.DOCUMENT].content).toContain(`<h1>My First Heading</h1>`);
            expect(item.extra[ItemType.DOCUMENT].content).toContain(`<p>My first paragraph.</p>`);

            // the script with a console should not appear in the text
            expect(item.extra[ItemType.DOCUMENT].content).not.toContain(`script`);
            expect(item.extra[ItemType.DOCUMENT].content).not.toContain(`console`);
          } else {
            throw new Error('did not find the wanted files');
          }
        }
      }, 1000);
    });
    it('Throws if signed out', async () => {
      const form = createFormData('archive.zip');

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/zip-import',
        payload: form,
        headers: form.getHeaders(),
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('Import a Graasp archive successfully', async () => {
      // Set the variables that can be found in the manifest.json file of the graasp-archive.zip fixture
      const folderDescription = '<p>A Graasp export folder</p>';
      const documentContent = '<p>Hello.</p>';
      const pdfName = 'output.pdf';
      const pdfContent = 'This is a real document.';
      const h5pFilename = 'test-05-collage-54.h5p';
      const appUrl = 'https://justinjackson.ca/words.html';
      const appName = 'My App';

      // Create the actor and the parent item
      const {
        actor,
        items: [parentItem],
      } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // Import the graasp export file
      const form = createFormData('graasp-archive.zip');
      const importResponse = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/zip-import',
        payload: form,
        headers: form.getHeaders(),
        query: { parentId: parentItem.id },
      });
      expect(importResponse.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        // Check that all the uploaded items found in the manifest are in place
        const itemsInDB = await db.query.itemsRawTable.findMany({
          where: and(
            isDescendantOrSelf(itemsRawTable.path, parentItem.path),
            ne(itemsRawTable.id, parentItem.id),
          ),
          orderBy: [asc(itemsRawTable.order), asc(itemsRawTable.path)],
        });
        const folderItem = itemsInDB[0];
        const documentItem = itemsInDB[1];
        const fileItem = itemsInDB[2];
        const h5pItem = itemsInDB[3];
        const appItem = itemsInDB[4];

        // Check that all the items have been imported and that their order is correct
        expect(itemsInDB.length).toEqual(5);
        expect(folderItem.type).toEqual(ItemType.FOLDER);
        expect(documentItem.type).toEqual(ItemType.DOCUMENT);
        expect(fileItem.type).toEqual(ItemType.FILE);
        expect(h5pItem.type).toEqual(ItemType.H5P);
        expect(appItem.type).toEqual(ItemType.APP);
        expect(Number(itemsInDB[1].order)).toBeLessThan(Number(itemsInDB[2].order));

        // Check that all the item properties have been assigned for the document type
        expect(folderItem.description).toEqual(folderDescription);

        // Check that all the item properties have been assigned for the document type
        expect(documentItem.extra[ItemType.DOCUMENT]).toBeDefined();
        expect(documentItem.extra[ItemType.DOCUMENT].content).toEqual(documentContent);

        // Check that all the item properties have been assigned for the file type
        const fileItemProperties = fileItem.extra[ItemType.FILE] as FileItemProperties;

        expect(fileItemProperties).toBeDefined();
        expect(fileItemProperties.name).toEqual(pdfName);
        expect(fileItemProperties.path).toBeDefined();
        expect(fileItemProperties.mimetype).toEqual(MimeTypes.PDF);
        expect(fileItemProperties.content).toEqual(pdfContent);

        // Check the the file item thumbnail has been imported correctly
        expect(fileItem.settings.hasThumbnail).toBeTruthy();
        const thumbnailURLResponse = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${fileItem.id}${THUMBNAILS_ROUTE_PREFIX}/${ThumbnailSize.Original}`,
        });
        expect(thumbnailURLResponse.statusCode).toBe(StatusCodes.OK);

        // Check the H5P item
        expect(h5pItem.name).toEqual(h5pFilename);

        // Check the APP item
        expect(appItem.extra[ItemType.APP]).toBeDefined();
        expect(appItem.extra[ItemType.APP].url).toEqual(appUrl);
        const appSetting = await db.query.appSettingsTable.findFirst({
          where: eq(appSettingsTable.itemId, appItem.id),
        });
        expect(appSetting).toBeDefined();
        expect(appSetting!.name).toEqual(appName);
      });
    });
  });

  describe('POST /api/download-file', () => {
    it('Export successfully if has access', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            name: 'item-name',
            type: ItemType.DOCUMENT,
            extra: { document: { content: 'my text', isRaw: false } },
            memberships: [{ account: 'actor', permission: 'read' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/download-file`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.headers['content-disposition']).toContain(item.name);
    });
    it('Export successfully for guest', async () => {
      const {
        guests: [guest],
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            name: 'item-name',
            type: ItemType.DOCUMENT,
            extra: { document: { content: 'my text', isRaw: false } },
            itemLoginSchema: { guests: [{}] },
          },
        ],
      });
      mockAuthenticate(guest);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/download-file`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.headers['content-disposition']).toContain(item.name);
    });
    it('Export successfully for public item', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            name: 'item-name',
            type: ItemType.DOCUMENT,
            extra: { document: { content: 'my text', isRaw: false } },
            isPublic: true,
          },
        ],
      });

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/download-file`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.headers['content-disposition']).toContain(item.name);
    });

    it('Export successfully h5p file', async () => {
      const { actor } = await seedFromJson({});
      assertIsDefined(actor);
      mockAuthenticate(actor);

      // mocks - fetching some h5p content
      jest.spyOn(LocalFileRepository.prototype, 'getUrl').mockImplementation(async () => 'getUrl');
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
        return {
          body: fs.createReadStream(path.resolve(__dirname, './test/fixtures/accordion.h5p')),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      });

      const form = new FormData();
      form.append(
        'myfile',
        fs.createReadStream(path.resolve(__dirname, './test/fixtures/accordion.h5p')),
      );

      const h5pUploadResponse = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/h5p-import',
        payload: form,
        headers: form.getHeaders(),
      });

      const { id: h5pId, name: h5pName } = h5pUploadResponse.json();

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${h5pId}/download-file`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.payload.length).toBeGreaterThan(100);
      expect(response.headers['content-disposition']).toContain(h5pName);
      expect(response.headers['content-disposition']).toContain('.h5p');
      expect(response.headers['content-disposition']).not.toContain('.zip');
    });
    it('Throw for folder', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/download-file`,
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /export', () => {
    it('Export successfully if signed in', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ name: 'item-name', memberships: [{ account: 'actor' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/export`,
      });
      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const waitingJobs = await importExportQueue.getWaiting();
        // we should find a waiting job for our item in the queue
        const ourJob = waitingJobs.find(({ data }) => data.itemId === item.id);
        expect(ourJob).toBeTruthy();
        expect(ourJob.data.memberId).toEqual(actor.id);
      });
    });

    it('Throw if member is guest', async () => {
      const {
        items: [item],
        guests: [guest],
      } = await seedFromJson({
        actor: null,
        items: [
          {
            name: 'item-name',
            itemLoginSchema: { guests: [{}] },
          },
        ],
      });
      mockAuthenticate(guest);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${item.id}/export`,
      });
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    it('Throw for document item', async () => {
      const {
        actor,
        items: [{ id: documentId }],
      } = await seedFromJson({
        items: [
          { ...ItemFactory({ type: ItemType.DOCUMENT }), memberships: [{ account: 'actor' }] },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${documentId}/export`,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /api/graasp-export', () => {
    it('Exports successfully if signed in', async () => {
      const { actor, items } = await seedFromJson({
        actor: {},
        items: [
          {
            name: 'itemname',
            memberships: [{ account: `actor` }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${items[0].id}/graasp-export`,
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.headers['content-disposition']).toContain(items[0].name);
    });

    it('Graasp export recreates the file structure', async () => {
      const { actor, folderItem, firstLevelItems, secondLevelItems, appItem } =
        await setupActorAndItems();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/items/${folderItem!.id}/graasp-export`,
      });

      const { targetFolder, manifestItems } = await readResponseStream(response.stream());

      // check that the item quantities and order is correct for all the hierarchy levels

      expect(manifestItems.length).toBe(1);
      expect(manifestItems[0].name === folderItem!.name).toBeTruthy();

      const foundFirstLevelChildren = manifestItems[0].children;
      expect(foundFirstLevelChildren?.length === firstLevelItems.length).toBeTruthy();
      expect(foundFirstLevelChildren?.map((x) => x.name)).toEqual(
        firstLevelItems.map((x) => x.name),
      );

      const foundSecondLevelChildren = foundFirstLevelChildren![0].children;
      expect(foundSecondLevelChildren?.length === secondLevelItems.length).toBeTruthy();
      expect(foundSecondLevelChildren?.map((x) => x.name)).toEqual(
        secondLevelItems.map((x) => x.name),
      );

      const foundAppItem = foundSecondLevelChildren?.find((i) => i.type === ItemType.APP);
      expect(foundAppItem).toBeDefined();
      expect(foundAppItem!.appSettings).toBeDefined();
      expect(foundAppItem!.appSettings![0].name).toEqual(appItem.appSettings[0].name);

      // delete the folder in which the files were unzipped
      fs.rmSync(targetFolder, { recursive: true });
    });
  });
});
