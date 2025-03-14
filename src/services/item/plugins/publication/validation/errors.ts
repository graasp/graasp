import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

import { PLUGIN_NAME } from './constants.js';

const GraaspValidationError = ErrorFactory(PLUGIN_NAME);

export class InvalidFileItemError extends GraaspValidationError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPVERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'File properties are invalid.',
      },
      data,
    );
  }
}

export class FailedImageClassificationRequestError extends GraaspValidationError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPVERR002',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Image classification request failed',
      },
      data,
    );
  }
}

export class ProcessNotFoundError extends GraaspValidationError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPVERR003',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Process Not Found',
      },
      data,
    );
  }
}

export class ProcessExecutionError extends GraaspValidationError {
  constructor(process: string, data?: unknown) {
    super(
      {
        code: 'GPVERR004',
        statusCode: StatusCodes.BAD_REQUEST,
        message: `An error occurs during execution process: ${process}`,
      },
      data,
    );
  }
}

export class ItemValidationError extends GraaspValidationError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPVERR005',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'An error occurs while validating the item',
      },
      data,
    );
  }
}

export class ItemValidationGroupNotFound extends GraaspValidationError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPVERR006',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Item validation group not found',
      },
      data,
    );
  }
}

export class ItemValidationNotFound extends GraaspValidationError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPVERR007',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Item validation not found',
      },
      data,
    );
  }
}

export class ItemValidationAlreadyExist extends GraaspValidationError {
  constructor(itemId: string) {
    super(
      {
        code: 'GPVERR008',
        statusCode: StatusCodes.CONFLICT,
        message: `Item validation already exists for item ${itemId}`,
      },
      itemId,
    );
  }
}

export class ItemValidationReviewNotFound extends GraaspValidationError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPVERR009',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Item validation review not found',
      },
      data,
    );
  }
}
