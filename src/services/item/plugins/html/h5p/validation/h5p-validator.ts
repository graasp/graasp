// import { Ajv } from 'ajv';
// import fs from 'fs';
// import { readFile } from 'fs/promises';
// import path from 'path';
// import { safeParse } from 'secure-json-parse';

// import { HtmlValidator } from '../../validator';
// import { H5PInvalidManifestError } from '../errors';
// import { h5pManifestSchema } from '../schemas';
// import { H5P } from './h5p';

// const ajv = new Ajv({ allowUnionTypes: true });

// /**
//  * Utility class containing the logic to validate a .h5p package
//  * This object should be implementation-agnostic (could be reused for other H5P projects)
//  */
// export class H5PValidator implements HtmlValidator {
//   private isValidManifest = ajv.compile(h5pManifestSchema);

//   // Helper to locate the main h5p.json inside an extracted H5P package
//   private buildManifestPath = (extractedContentDir: string) =>
//     path.join(extractedContentDir, 'h5p.json');

//   // Allow uploads of H5P.org-approved file extensions, and h5p files themselves
//   private allowedExtensions = H5P.ALLOWED_FILE_EXTENSIONS.concat([H5P.H5P_FILE_EXTENSION]);

//   /**
//    * Checks whether a given file extension is allowed inside a .h5p package
//    * @param extension A string representing the file extension (may or may not contain leading dot or be uppercase)
//    * @return true if the file extension is allowed, false otherwise
//    */
//   isExtensionAllowed(extension: string) {
//     const normalizedExtension = (
//       extension[0] === '.' ? extension.slice(1) : extension
//     ).toLowerCase();
//     return this.allowedExtensions.includes(normalizedExtension);
//   }

//   /**
//    * Validates an extracted H5P package content against the (poorly documented) H5P spec
//    * https://h5p.org/documentation/developers/h5p-specification
//    * https://h5p.org/creating-your-own-h5p-plugin
//    * @param extractedH5PRoot String of the root path where the .h5p package has been extracted
//    */
//   async validatePackage(extractedH5PRoot: string) {
//     // Check if h5p.json manifest file exists
//     const manifestPath = this.buildManifestPath(extractedH5PRoot);
//     if (!fs.existsSync(manifestPath)) {
//       throw new H5PInvalidManifestError('Missing h5p.json manifest file');
//     }

//     // Check if h5p.json manifest file has expected JSON structure
//     const manifestJSON = await readFile(manifestPath, { encoding: 'utf-8' });
//     let manifest = safeParse(manifestJSON);

//     if (manifest === null || !this.isValidManifest(manifest)) {
//       const errors = this.isValidManifest.errors
//         ?.map((e) => `${e.instancePath && `${path.basename(e.instancePath)} `}${e.message}`)
//         ?.join('\n\t');
//       throw new H5PInvalidManifestError(errors);
//     }

//     // TODO: types
//     manifest = manifest as {
//       preloadedDependencies: { machineName: string }[];
//       mainLibrary: string;
//     };
//     // The 'preloadedDependencies' field must at least contain the main library of the package
//     if (!manifest.preloadedDependencies.find((dep) => dep.machineName === manifest.mainLibrary)) {
//       throw new H5PInvalidManifestError('main library not found in preloaded dependencies');
//     }

//     // All checks are performed
//   }
// }
