import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

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
  constructor(data?: unknown) {
    super(
      {
        code: 'GPFERR005',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_DOWNLOAD_PARAMETERS,
      },
      data,
    );
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

export class UploadEmptyFileError extends GraaspFileError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GPFERR008',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.UPLOAD_EMPTY_FILE,
      },
      data,
    );
  }
}
