import cs from 'checksum';
import FormData from 'form-data';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import tmp, { DirectoryResult } from 'tmp-promise';
import util from 'util';

import fastify, { FastifyInstance, FastifyRequest } from 'fastify';

import { ItemType } from '@graasp/sdk';

import plugin from '../';
import { Member } from '../../../../member/entities/member';
import ItemService from '../../../service';
import { H5P_PACKAGES } from './fixtures';

type Awaited<T> = T extends PromiseLike<infer U> ? U : T;
export type BuildAppType = Awaited<ReturnType<typeof buildApp>>;

const checksum = {
  file: util.promisify(cs.file),
};

/**
 * Builds a base fastify instance for testing the H5P plugin
 */
export async function buildApp(args?: {
  options?: {
    pathPrefix?: string;
    storageRootPath?: string;
    extractionRootPath?: string;
  };
}) {
  const { options } = args ?? {};

  const tmpDirs: Array<DirectoryResult> = [];
  async function tmpDir(options: any = { unsafeCleanup: true }) {
    const entry = await tmp.dir(options);
    tmpDirs.push(entry);
    return entry.path;
  }

  const pathPrefix = options?.pathPrefix ?? 'h5p';
  const storageRootPath = options?.storageRootPath ?? (await tmpDir());
  const extractionRootPath = options?.extractionRootPath ?? (await tmpDir());

  const app = fastify();

  app.decorate('items', { service: new ItemService() });
  app.decorate('verifyAuthentication', (request: FastifyRequest) => {
    request.member = new Member();
  });

  // uuid schema referenced from h5pImport schema should be registered by core
  // we use a simple string schema instead
  app.addSchema({
    $id: 'http://graasp.org/',
    type: 'object',
    definitions: {
      uuid: { type: 'string' },
    },
  });

  const registerH5PPlugin = async () =>
    await app.register(plugin, {
      fileStorage: {
        type: ItemType.LOCAL_FILE,
        pathPrefix,
        config: {
          local: {
            storageRootPath,
          },
        },
      },
      tempDir: extractionRootPath,
    });

  const cleanup = async () => {
    return Promise.all(tmpDirs.map(async (dir) => await dir.cleanup()));
  };

  return {
    app,
    registerH5PPlugin,
    options: {
      pathPrefix,
      storageRootPath,
      extractionRootPath,
    },
    cleanup,
  };
}

/**
 * Injects a test client request to import an H5P file
 */
export function injectH5PImport(
  app: FastifyInstance,
  options?: { filePath?: string; parentId?: string },
) {
  const { filePath, parentId } = options ?? {};

  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath ?? H5P_PACKAGES.ACCORDION.path));

  return app.inject({
    method: 'POST',
    url: '/h5p-import',
    payload: formData,
    headers: formData.getHeaders(),
    query: { parentId: parentId ?? 'mock-parent-id' },
  });
}

/**
 * Helper to expect correct H5P upload
 */
export async function expectH5PFiles(
  h5p: { path: string; manifest: unknown },
  storageRootPath: string,
  pathPrefix: string,
  contentId: string,
) {
  // root extraction folder exists
  const root = path.resolve(storageRootPath, pathPrefix, contentId);
  expect(fs.existsSync(root)).toBeTruthy();

  // .h5p package exists and is same file as original
  const fileName = path.basename(h5p.path);
  const h5pFile = path.resolve(root, fileName);
  expect(fs.existsSync(h5pFile)).toBeTruthy();
  expect(await checksum.file(h5pFile)).toEqual(await checksum.file(h5p.path));

  // content folder exists
  const contentFolder = path.resolve(root, 'content');
  expect(fs.existsSync(contentFolder)).toBeTruthy();

  // h5p.json manifest file exists and is same file as original
  const manifestFile = path.resolve(contentFolder, 'h5p.json');
  expect(fs.existsSync(manifestFile)).toBeTruthy();
  const parsedManifest = JSON.parse(await fsp.readFile(manifestFile, { encoding: 'utf-8' }));
  expect(parsedManifest).toEqual(h5p.manifest);
}
