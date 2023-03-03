import { ItemType } from '@graasp/sdk';
import fs from 'fs/promises';
import { StatusCodes } from 'http-status-codes';
import path from 'path';
import tmp, { DirectoryResult } from 'tmp-promise';

import fastify, { FastifyInstance } from 'fastify';

import { DEFAULT_H5P_ASSETS_ROUTE, DEFAULT_H5P_CONTENT_ROUTE } from '../src/constants';
import publicPlugin from '../src/public-api';
import { H5PService } from '../src/service';
import { H5P_STANDALONE_ASSETS_FILES } from './fixtures';

describe.each([
  undefined,
  {
    assets: '/custom-assets-route/',
    content: '/custom-content-route/',
  },
])('Public plugin with route options: %o', (routes) => {
  /** instance under test */
  let app: FastifyInstance;
  let tmpDir: DirectoryResult;
  const pathPrefix = 'h5p';

  beforeAll(async () => {
    app = fastify();
    tmpDir = await tmp.dir({ unsafeCleanup: true });
    await app.register(publicPlugin, {
      fileItemType: ItemType.LOCAL_FILE,
      fileConfigurations: {
        local: {
          storageRootPath: tmpDir.path,
        },
        // todo: file service refactor should not require both configs
        s3: {
          s3Region: 'mock-s3-region',
          s3Bucket: 'mock-s3-bucket',
          s3AccessKeyId: 'mock-s3-access-key-id',
          s3SecretAccessKey: 'mock-s3-secret-access-key',
        },
      },
      pathPrefix,
      routes,
    });
  });

  afterAll(() => {
    tmpDir.cleanup();
  });

  it('decorates the fastify instance with h5p service', () => {
    expect(app.h5p).toBeDefined();
    expect(app.h5p instanceof H5PService).toBeTruthy();
  });

  it.each(H5P_STANDALONE_ASSETS_FILES)('serves H5P asset: %s', async (file) => {
    const response = await app.inject({
      method: 'GET',
      url: path.join(routes?.assets ?? DEFAULT_H5P_ASSETS_ROUTE, file),
    });
    expect(response.statusCode).toEqual(StatusCodes.OK);
  });

  it('returns 404 on non-existing asset', async () => {
    const response = await app.inject({
      method: 'GET',
      url: path.join(routes?.assets ?? DEFAULT_H5P_ASSETS_ROUTE, 'foobar'),
    });
    expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
  });

  it('serves stored example H5P content', async () => {
    const exampleFilename = 'hello-h5p';
    const exampleContent = 'example-content';
    const h5pFolderPath = path.resolve(tmpDir.path, pathPrefix);
    await fs.mkdir(h5pFolderPath, { recursive: true });
    const contentPath = path.resolve(h5pFolderPath, exampleFilename);
    await fs.writeFile(contentPath, exampleContent, { encoding: 'utf-8' });
    const response = await app.inject({
      method: 'GET',
      url: path.join(routes?.content ?? DEFAULT_H5P_CONTENT_ROUTE, exampleFilename),
    });
    expect(response.statusCode).toEqual(StatusCodes.OK);
    expect(response.body).toEqual(exampleContent);
  });

  it('returns 404 on non-existing content', async () => {
    const response = await app.inject({
      method: 'GET',
      url: path.join(routes?.content ?? DEFAULT_H5P_CONTENT_ROUTE, 'foobar'),
    });
    expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
  });

  it('serves integration file', async () => {
    const response = await app.inject({
      method: 'GET',
      url: path.join(routes?.assets ?? DEFAULT_H5P_ASSETS_ROUTE, 'integration.html'),
    });
    expect(response.statusCode).toEqual(StatusCodes.OK);
  });
});
