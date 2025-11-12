import { file } from 'checksum';
import FormData from 'form-data';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import util from 'util';

import type { FastifyInstance } from 'fastify';

import { H5P_PACKAGES } from './fixtures';

const checksum = {
  file: util.promisify(file),
};

/**
 * Injects a test client request to import an H5P file
 */
export function injectH5PImport(
  app: FastifyInstance,
  options?: { filePath?: string; parentId?: string; previousItemId?: string },
) {
  const { filePath, parentId, previousItemId } = options ?? {};

  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath ?? H5P_PACKAGES.ACCORDION.path));

  const query: { parentId?: string; previousItemId?: string } = {};
  if (options?.parentId) {
    query.parentId = parentId;
  }
  if (options?.previousItemId) {
    query.previousItemId = previousItemId;
  }

  return app.inject({
    method: 'POST',
    url: '/api/items/h5p-import',
    payload: formData,
    headers: formData.getHeaders(),
    query,
  });
}
/**
 * Helper to expect correct H5P upload
 */
export async function expectH5PFiles(
  h5p: { path: string; manifest: unknown },
  storageRootPath: string,
  pathPrefix: string | undefined,
  contentId: string,
) {
  // root extraction folder exists
  const root = pathPrefix
    ? path.resolve(storageRootPath, pathPrefix, contentId)
    : path.resolve(storageRootPath, contentId);
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
