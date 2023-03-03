import Ajv from 'ajv';
import fs from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import secureJSON from 'secure-json-parse';

import { H5P } from './h5p';

// const ajv = new Ajv();

/**
 * Utility class containing the logic to validate a .h5p package
 * This object should be implementation-agnostic (could be reused for other H5P projects)
 */
export class H5PValidator {
  // ajv JSON validator for the manifest schema

  // TODO: enable back
  // private isValidManifest = ajv.compile(h5pManifestSchema);

  // Helper to locate the main h5p.json inside an extracted H5P package
  private buildManifestPath = (extractedContentDir: string) =>
    path.join(extractedContentDir, 'h5p.json');

  // Allow uploads of H5P.org-approved file extensions, and h5p files themselves
  private allowedExtensions = H5P.ALLOWED_FILE_EXTENSIONS.concat([H5P.H5P_FILE_EXTENSION]);

  /**
   * Checks whether a given file extension is allowed inside a .h5p package
   * @param extension A string representing the file extension (may or may not contain leading dot or be uppercase)
   * @return true if the file extension is allowed, false otherwise
   */
  isExtensionAllowed(extension: string) {
    const normalizedExtension = (
      extension[0] === '.' ? extension.slice(1) : extension
    ).toLowerCase();
    return this.allowedExtensions.includes(normalizedExtension);
  }

  /**
   * Validates an extracted H5P package content against the (poorly documented) H5P spec
   * https://h5p.org/documentation/developers/h5p-specification
   * https://h5p.org/creating-your-own-h5p-plugin
   * @param extractedH5PRoot String of the root path where the .h5p package has been extracted
   */
  async validatePackage(
    extractedH5PRoot: string,
  ): Promise<{ isValid: false; error: string } | { isValid: true; manifest: H5P.Manifest }> {
    // Check if h5p.json manifest file exists
    const manifestPath = this.buildManifestPath(extractedH5PRoot);
    if (!fs.existsSync(manifestPath)) {
      return { isValid: false, error: 'Missing h5p.json manifest file' };
    }

    // Check if h5p.json manifest file has expected JSON structure
    const manifestJSON = await readFile(manifestPath, { encoding: 'utf-8' });
    let manifest = secureJSON.safeParse(manifestJSON);
    
    // TODO: enable back
    // if (manifest === null || !this.isValidManifest(manifest)) {
    //   const errors = this.isValidManifest.errors
    //     ?.map((e) => `${e.instancePath && `${path.basename(e.instancePath)} `}${e.message}`)
    //     ?.join('\n\t');
    //   return {
    //     isValid: false,
    //     error: `Invalid h5p.json manifest file: ${errors}`,
    //   };
    // }

    manifest = manifest as {preloadedDependencies:any, mainLibrary:any};
    // The 'preloadedDependencies' field must at least contain the main library of the package
    if (!manifest.preloadedDependencies.find((dep) => dep.machineName === manifest.mainLibrary)) {
      return {
        isValid: false,
        error: 'Invalid h5p.json manifest file: main library not found in preloaded dependencies',
      };
    }

    // All checks are performed
    return { isValid: true, manifest };
  }
}
