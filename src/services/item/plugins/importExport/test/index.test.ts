import { and, eq, ne } from 'drizzle-orm';
import FormData from 'form-data';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';
import path from 'path';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { db } from '../../../../../drizzle/db';
import { isDescendantOrSelf } from '../../../../../drizzle/operations';
import { itemsRaw } from '../../../../../drizzle/schema';
import { assertIsDefined } from '../../../../../utils/assertions';
import { LocalFileRepository } from '../../../../file/repositories/local';
import * as ARCHIVE_CONTENT from './fixtures/archive';

const getItemByName = async (itemName: string) => {
  return await db.query.itemsRaw.findFirst({
    where: eq(itemsRaw.name, itemName),
  });
};

// we need a different form data for each test
const createFormData = (filename: string) => {
  const form = new FormData();
  form.append('myfile', fs.createReadStream(path.resolve(__dirname, `./fixtures/${filename}`)));

  return form;
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

describe('ZIP routes tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
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

  describe('POST /zip-import', () => {
    it('Import successfully at root if signed in', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const form = createFormData('archive.zip');

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/zip-import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        // get actor's root items
        const rootItemResponse = await app.inject({
          method: HttpMethod.Get,
          url: '/items/accessible',
        });
        const rootItems = rootItemResponse.json().data;
        expect(rootItems).toHaveLength(7);

        // get one imported child in folder
        const parent = rootItems.find(({ name }) => name === ARCHIVE_CONTENT.folder.name);
        const itemsResponse = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${parent.id}/children`,
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

          if (item.type === ItemType.S3_FILE) {
            expect((item.extra[ItemType.S3_FILE] as { name: string }).name).toEqual(
              (file.extra[ItemType.S3_FILE] as { name: string }).name,
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
        url: '/items/zip-import',
        payload: form,
        query: { parentId: parentItem.id },
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const items = await db.query.itemsRaw.findMany({
          where: and(
            isDescendantOrSelf(itemsRaw.path, parentItem.path),
            ne(itemsRaw.id, parentItem.id),
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

          if (item.type === ItemType.S3_FILE) {
            expect((item.extra[ItemType.S3_FILE] as { name: string }).name).toEqual(
              (file.extra[ItemType.S3_FILE] as { name: string }).name,
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
        expect(child!.path).toContain(folderItem!.path);
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
        url: '/items/zip-import',
        payload: form,
        headers: form.getHeaders(),
        query: { parentId: parentItem.id },
      });

      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const items = await db.query.itemsRaw.findMany({
          where: and(
            isDescendantOrSelf(itemsRaw.path, parentItem.path),
            ne(itemsRaw.id, parentItem.id),
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
        url: '/items/zip-import',
        payload: form,
        headers: form.getHeaders(),
        query: { parentId: parentItem.id },
      });

      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const items = await db.query.itemsRaw.findMany({
          where: and(
            isDescendantOrSelf(itemsRaw.path, parentItem.path),
            ne(itemsRaw.id, parentItem.id),
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
        url: '/items/zip-import',
        payload: form,
        headers: form.getHeaders(),
      });
      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
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
        method: HttpMethod.Get,
        url: `/items/${item.id}/export`,
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
          body: fs.createReadStream(path.resolve(__dirname, './fixtures/accordion.h5p')),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
      });

      const form = new FormData();
      form.append(
        'myfile',
        fs.createReadStream(path.resolve(__dirname, './fixtures/accordion.h5p')),
      );

      const h5pUploadResponse = await app.inject({
        method: HttpMethod.Post,
        url: '/items/h5p-import',
        payload: form,
        headers: form.getHeaders(),
      });

      const { id: h5pId, name: h5pName } = h5pUploadResponse.json();

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/${h5pId}/export`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.payload.length).toBeGreaterThan(100);
      expect(response.headers['content-disposition']).toContain(h5pName);
      expect(response.headers['content-disposition']).toContain('.h5p');
      expect(response.headers['content-disposition']).not.toContain('.zip');
    });
  });
});
