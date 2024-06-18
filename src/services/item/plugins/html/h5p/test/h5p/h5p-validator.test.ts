import extract from 'extract-zip';
import fs from 'fs/promises';
import path from 'path';
import tmp, { DirectoryResult } from 'tmp-promise';

import { H5PInvalidManifestError } from '../../errors.js';
import { H5PValidator } from '../../validation/h5p-validator.js';
import { H5P } from '../../validation/h5p.js';
import { H5P_PACKAGES } from '../fixtures/index.js';

describe('H5PValidator', () => {
  const h5pValidator = new H5PValidator();

  describe('isExtensionAllowed', () => {
    it.each(H5P.ALLOWED_FILE_EXTENSIONS)('allows .%s extension from spec', (ext) => {
      expect(h5pValidator.isExtensionAllowed(ext)).toBeTruthy();
    });

    it('allows .h5p extension', () => {
      expect(h5pValidator.isExtensionAllowed('h5p')).toBeTruthy();
    });

    it('allows uppercase extension', () => {
      expect(h5pValidator.isExtensionAllowed('JPEG')).toBeTruthy();
    });

    it('allows dotted extension', () => {
      expect(h5pValidator.isExtensionAllowed('.jpeg')).toBeTruthy();
    });

    it.each(['exe', 'sh', 'php', 'html'])('rejects example harmful .%s extension', (ext) => {
      expect(h5pValidator.isExtensionAllowed(ext)).toBeFalsy();
    });
  });

  describe('validatePackage', () => {
    let dir: DirectoryResult;

    beforeEach(async () => {
      dir = await tmp.dir({ unsafeCleanup: true });
    });

    afterEach(async () => {
      dir.cleanup();
    });

    /**
     * Creates a manifest file at the current <dir.path>/h5p.json with the serialized <content>
     */
    async function createManifest<T>(content: T) {
      const serialized = JSON.stringify(content);
      await fs.writeFile(path.join(dir.path, 'h5p.json'), serialized, { encoding: 'utf-8' });
    }

    it('accepts valid H5P package', async () => {
      await extract(H5P_PACKAGES.ACCORDION.path, { dir: dir.path });
      expect(async () => await h5pValidator.validatePackage(dir.path)).not.toThrow();
    });

    it('rejects folder without an h5p.json manifest', async () => {
      expect(async () => await h5pValidator.validatePackage(dir.path)).rejects.toMatchObject(
        new H5PInvalidManifestError('Missing h5p.json manifest file'),
      );
    });

    it('rejects null h5p.json manifest', async () => {
      await createManifest(null);
      expect(async () => await h5pValidator.validatePackage(dir.path)).rejects.toMatchObject(
        new H5PInvalidManifestError(undefined),
      );
    });

    it.each([
      {
        error: 'title must be string',
        injected: { title: 2 },
      },
      {
        error: "must have required property 'mainLibrary'",
        injected: { mainLibrary: undefined },
      },
      {
        error: 'language must be equal to one of the allowed values',
        injected: { language: 'en-US' },
      },
      {
        error: 'embedTypes must be array',
        injected: { embedTypes: 'foo' },
      },
    ])('rejects invalid h5p.json manifest: $error', async ({ injected, error }) => {
      await createManifest({
        ...H5P_PACKAGES.ACCORDION.manifest,
        ...injected,
      });
      expect(async () => await h5pValidator.validatePackage(dir.path)).rejects.toMatchObject(
        new H5PInvalidManifestError(error),
      );
    });

    it('rejects invalid h5p.json manifest: main library missing from preloaded dependencies', async () => {
      const manifest = H5P_PACKAGES.ACCORDION.manifest;
      await createManifest({
        ...manifest,
        preloadedDependencies: manifest.preloadedDependencies.filter(
          ({ machineName }) => machineName !== manifest.mainLibrary,
        ),
      });
      expect(async () => await h5pValidator.validatePackage(dir.path)).rejects.toMatchObject(
        new H5PInvalidManifestError(`main library not found in preloaded dependencies`),
      );
    });
  });
});
