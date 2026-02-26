import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

export const H5PInvalidFileError = createError(
  'GPH5PERR001',
  'File is not a valid H5P package',
  StatusCodes.BAD_REQUEST,
);

export const H5PInvalidManifestError = createError(
  'GPH5PERR002',
  'Invalid h5p.json manifest file',
  StatusCodes.BAD_REQUEST,
);
