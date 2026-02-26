import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { ErrorFactory, FAILURE_MESSAGES } from '@graasp/sdk';

import { PLUGIN_NAME } from './constants';

export const GraaspFileError = ErrorFactory(PLUGIN_NAME);

export class UploadFileInvalidParameterError extends GraaspFileError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPFERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_UPLOAD_PARAMETERS,
      },
      data,
    );
  }
}

export class CopyFileInvalidPathError extends GraaspFileError {
  constructor(filepath?: unknown) {
    super(
      {
        code: 'GPFERR002',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_FILE_PATH_FOR_COPY,
      },
      filepath,
    );
  }
}

export class CopyFolderInvalidPathError extends GraaspFileError {
  constructor(filepath?: unknown) {
    super(
      {
        code: 'GPFERR009',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_FILE_PATH_FOR_COPY,
      },
      filepath,
    );
  }
}

export class DeleteFileInvalidPathError extends GraaspFileError {
  constructor(filepath?: unknown) {
    super(
      {
        code: 'GPFERR003',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_FILE_PATH_FOR_DELETE,
      },
      filepath,
    );
  }
}

export class DeleteFolderInvalidPathError extends GraaspFileError {
  constructor(folderPath?: unknown) {
    super(
      {
        code: 'GPFERR004',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_FOLDER_PATH_FOR_DELETE,
      },
      folderPath,
    );
  }
}

export class DownloadFileInvalidParameterError extends GraaspFileError {
  constructor() {
    super({
      code: 'GPFERR005',
      statusCode: StatusCodes.BAD_REQUEST,
      // todo: change message to indicate the the filepath did not exist
      message: FAILURE_MESSAGES.INVALID_DOWNLOAD_PARAMETERS,
    });
  }
}

export class LocalFileNotFound extends GraaspFileError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPFERR006',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.LOCAL_FILE_NOT_FOUND,
      },
      data,
    );
  }
}

export class S3FileNotFound extends GraaspFileError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPFERR007',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.S3_FILE_NOT_FOUND,
      },
      data,
    );
  }
}

export const UploadEmptyFileError = createError(
  'GPFERR008',
  FAILURE_MESSAGES.UPLOAD_EMPTY_FILE,
  StatusCodes.BAD_REQUEST,
);

export const UploadFileUnexpectedError = createError(
  'GPFERR010',
  FAILURE_MESSAGES.UPLOAD_FILE_UNEXPECTED_ERROR,
  StatusCodes.INTERNAL_SERVER_ERROR,
);

export class DownloadFileUnexpectedError extends GraaspFileError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPFERR011',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        // TODO: change message
        message: FAILURE_MESSAGES.DOWNLOAD_FILE_UNEXPECTED_ERROR,
      },
      data,
    );
  }
}

export class MalformedFileConfigError extends GraaspFileError {
  constructor(message: string) {
    super({
      code: 'GPFERR012',
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      message,
    });
  }
}
