import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

export const InvalidFileItemError = createError(
  'GPVERR001',
  'File properties are invalid.',
  StatusCodes.BAD_REQUEST,
);

export const FailedImageClassificationRequestError = createError(
  'GPVERR002',
  'Image classification request failed',
  StatusCodes.BAD_REQUEST,
);

export const ProcessNotFoundError = createError(
  'GPVERR003',
  'Process Not Found',
  StatusCodes.BAD_REQUEST,
);

export const ProcessExecutionError = createError(
  'GPVERR004',
  'Execution process error',
  StatusCodes.BAD_REQUEST,
);

export const ItemValidationError = createError(
  'GPVERR005',
  'An error occurs while validating the item',
  StatusCodes.BAD_REQUEST,
);

export const ItemValidationGroupNotFound = createError(
  'GPVERR006',
  'Item validation group not found',
  StatusCodes.NOT_FOUND,
);

export const ItemValidationNotFound = createError(
  'GPVERR007',
  'Item validation not found',
  StatusCodes.NOT_FOUND,
);

export const ItemValidationAlreadyExist = createError(
  'GPVERR008',
  'Item validation already exists',
  StatusCodes.CONFLICT,
);

export const ItemValidationReviewNotFound = createError(
  'GPVERR009',
  'Item validation review not found',
  StatusCodes.NOT_FOUND,
);
