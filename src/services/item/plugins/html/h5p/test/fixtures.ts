import path from 'path';

export const H5P_PACKAGES = {
  ACCORDION: {
    path: path.resolve(__dirname, 'fixtures/accordion-6-7138.h5p'),
    manifest: {
      title: 'Accordion',
      language: 'und',
      mainLibrary: 'H5P.Accordion',
      embedTypes: ['div'],
      license: 'U',
      preloadedDependencies: [
        { machineName: 'H5P.AdvancedText', majorVersion: '1', minorVersion: '1' },
        { machineName: 'H5P.Accordion', majorVersion: '1', minorVersion: '0' },
        { machineName: 'FontAwesome', majorVersion: '4', minorVersion: '5' },
      ],
    },
  },
  BOGUS_EMPTY: {
    path: path.resolve(__dirname, 'fixtures/empty.h5p'),
  },
  VALID_YEAR_AS_NUMBER: {
    path: path.resolve(__dirname, 'fixtures/yearFrom-lumi.h5p'),
  },
  BOGUS_WRONG_EXTENSION: {
    path: path.resolve(__dirname, 'fixtures/illegal-extension.h5p'),
    manifest: {
      title: 'WrongExtension',
      language: 'und',
      mainLibrary: 'foo',
      embedTypes: ['div'],
      license: 'U',
      preloadedDependencies: [
        {
          machineName: 'foo',
          majorVersion: '0',
          minorVersion: '1',
        },
      ],
    },
  },
};

/**
 * This is the file list contained within the h5p-standalone release package
 * https://github.com/tunapanda/h5p-standalone/releases
 * Version: 3.5.1
 */
export const H5P_STANDALONE_ASSETS_FILES = [
  'fonts/h5p-core-27.eot',
  'fonts/h5p-core-27.svg',
  'fonts/h5p-core-27.ttf',
  'fonts/h5p-core-27.woff',
  'fonts/h5p-hub-publish.eot',
  'fonts/h5p-hub-publish.svg',
  'fonts/h5p-hub-publish.ttf',
  'fonts/h5p-hub-publish.woff',
  'frame.bundle.js',
  'main.bundle.js',
  'styles/h5p-admin.css',
  'styles/h5p-confirmation-dialog.css',
  'styles/h5p-core-button.css',
  'styles/h5p-hub-registration.css',
  'styles/h5p-hub-sharing.css',
  'styles/h5p.css',
];
