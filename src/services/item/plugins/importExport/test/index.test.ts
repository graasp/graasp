import FormData from 'form-data';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';
import path from 'path';
import waitForExpect from 'wait-for-expect';

import { HttpMethod, ItemType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { LocalFileRepository } from '../../../../file/repositories/local';
import { saveItemAndMembership } from '../../../../itemMembership/test/fixtures/memberships';
import { ItemRepository } from '../../../repository';
import * as ARCHIVE_CONTENT from './fixtures/archive';

// we need a different form data for each test
const createFormData = (filename) => {
  const form = new FormData();
  form.append('myfile', fs.createReadStream(path.resolve(__dirname, `./fixtures/${filename}`)));

  return form;
};

jest.mock('node-fetch');

// mock datasource
jest.mock('../../../../../plugins/datasource');

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
  description: ARCHIVE_CONTENT.link.description,
};

const iframelyResult = {
  meta: iframelyMeta,
  html: 'html',
  icons: [],
  thumbnails: [],
};

describe('ZIP routes tests', () => {
  let app, actor;

  beforeEach(() => {
    (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { json: async () => iframelyResult } as any;
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('POST /zip-import', () => {
    it('Import successfully if signed in', async () => {
      ({ app, actor } = await build());
      const form = createFormData('archive.zip');

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/zip-import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const items = await ItemRepository.find({ relations: { creator: true } });
        expect(items).toHaveLength(8);

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
            expect(item.extra).toEqual({ [ItemType.FOLDER]: { childrenOrder: expect.anything() } });
          } else {
            expect(item.extra).toEqual(file.extra);
          }
        }

        const child = await ItemRepository.findOne({
          where: { name: ARCHIVE_CONTENT.childContent.name },
        });
        const folderItem = await ItemRepository.findOne({
          where: { name: ARCHIVE_CONTENT.folder.name },
        });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect(child!.path).toContain(folderItem!.path);
      }, 5000);
    });
    it('Import archive with empty folder', async () => {
      ({ app } = await build());
      const form = createFormData('empty.zip');

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/zip-import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const items = await ItemRepository.find();
        expect(items).toHaveLength(1);
      }, 1000);
    });
    it('Import and sanitize html, txt and description', async () => {
      ({ app } = await build());
      const form = createFormData('htmlAndText.zip');

      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/zip-import',
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.ACCEPTED);

      await waitForExpect(async () => {
        const items = await ItemRepository.find();
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
      ({ app } = await build({ member: null }));
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

  describe('POST /zip-export', () => {
    it('Export successfully if signed in', async () => {
      ({ app, actor } = await build());
      const { item } = await saveItemAndMembership({ member: actor, item: { name: 'itemname' } });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/zip-export/${item.id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.headers['content-disposition']).toContain(item.name);
    });

    it('Export successfully h5p file', async () => {
      ({ app, actor } = await build());

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
        url: `/items/zip-export/${h5pId}`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.payload.length).toBeGreaterThan(100);
      expect(response.headers['content-disposition']).toContain(h5pName);
    });
  });
});
