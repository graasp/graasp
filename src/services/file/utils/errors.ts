import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { FAILURE_MESSAGES } from '@graasp/sdk';

export const UploadFileInvalidParameterError = createError(
  'GPFERR001',
  FAILURE_MESSAGES.INVALID_UPLOAD_PARAMETERS,
  StatusCodes.BAD_REQUEST,
);

export const CopyFileInvalidPathError = createError(
  'GPFERR002',
  FAILURE_MESSAGES.INVALID_FILE_PATH_FOR_COPY,
  StatusCodes.BAD_REQUEST,
);

export const CopyFolderInvalidPathError = createError(
  'GPFERR009',
  FAILURE_MESSAGES.INVALID_FILE_PATH_FOR_COPY,
  StatusCodes.BAD_REQUEST,
);

export const DeleteFileInvalidPathError = createError(
  'GPFERR003',
  FAILURE_MESSAGES.INVALID_FILE_PATH_FOR_DELETE,
  StatusCodes.BAD_REQUEST,
);

export const DeleteFolderInvalidPathError = createError(
  'GPFERR004',
  FAILURE_MESSAGES.INVALID_FOLDER_PATH_FOR_DELETE,
  StatusCodes.BAD_REQUEST,
);

export const DownloadFileInvalidParameterError = createError(
  'GPFERR005',
  FAILURE_MESSAGES.INVALID_DOWNLOAD_PARAMETERS,
  StatusCodes.BAD_REQUEST,
);

export const LocalFileNotFound = createError(
  'GPFERR006',
  FAILURE_MESSAGES.LOCAL_FILE_NOT_FOUND,
  StatusCodes.NOT_FOUND,
);

export const S3FileNotFound = createError(
  'GPFERR007',
  FAILURE_MESSAGES.S3_FILE_NOT_FOUND,
  StatusCodes.NOT_FOUND,
);

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

export const DownloadFileUnexpectedError = createError(
  'GPFERR011',
  FAILURE_MESSAGES.DOWNLOAD_FILE_UNEXPECTED_ERROR,
  StatusCodes.INTERNAL_SERVER_ERROR,
);

export const MalformedFileConfigError = createError(
  'GPFERR012',
  'Malformed file configuration',
  StatusCodes.INTERNAL_SERVER_ERROR,
);