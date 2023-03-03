import fastifyMultipart from '@fastify/multipart';
import { FastifyPluginAsync } from 'fastify';

import { FileItemType, ItemType, LocalFileConfiguration, S3FileConfiguration } from '@graasp/sdk';

import FileService from './service';
import { DEFAULT_MAX_FILE_SIZE, MAX_NUMBER_OF_FILES_UPLOAD } from './utils/constants';

export interface GraaspPluginFileOptions {
  shouldRedirectOnDownload?: boolean; // redirect value on download
  uploadMaxFileNb?: number; // max number of files to upload at a time
  maxFileSize?: number; // max size for an uploaded file in bytes
  fileItemType: FileItemType; // S3 or local

  fileConfigurations: {
    s3: S3FileConfiguration;
    local: LocalFileConfiguration;
  };
}

const basePlugin: FastifyPluginAsync<GraaspPluginFileOptions> = async (fastify, options) => {
  const {
    fileItemType,
    fileConfigurations,
    uploadMaxFileNb = MAX_NUMBER_OF_FILES_UPLOAD,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    shouldRedirectOnDownload = true,
  } = options;

  // if (!buildFilePath) {
  //   throw new Error('graasp-plugin-file: buildFilePath is not defined');
  // }

  if (
    fileItemType === ItemType.LOCAL_FILE &&
    !fileConfigurations?.local?.storageRootPath.startsWith('/')
  ) {
    throw new Error('graasp-plugin-file: local service storageRootPath is malformed');
  }

  if (fileItemType === ItemType.S3_FILE) {
    // if (buildFilePath('itemId', 'filename').startsWith('/')) {
    //   throw new Error('graasp-plugin-file: buildFilePath is not well defined');
    // }

    if (
      !fileConfigurations?.s3?.s3Region ||
      !fileConfigurations?.s3?.s3Bucket ||
      !fileConfigurations?.s3?.s3AccessKeyId ||
      !fileConfigurations?.s3?.s3SecretAccessKey
    ) {
      throw new Error('graasp-plugin-file: mandatory options for s3 service missing');
    }
  }

  fastify.register(fastifyMultipart, {
    limits: {
      // fieldNameSize: 0,             // Max field name size in bytes (Default: 100 bytes).
      // fieldSize: 1000000,           // Max field value size in bytes (Default: 1MB).
      fields: 5, // Max number of non-file fields (Default: Infinity).
      // allow some fields for app data and app setting
      fileSize: maxFileSize, // For multipart forms, the max file size (Default: Infinity).
      files: uploadMaxFileNb, // Max number of file fields (Default: Infinity).
      // headerPairs: 2000             // Max number of header key=>value pairs (Default: 2000 - same as node's http).
    },
  });

  const fS = new FileService(fileConfigurations, fileItemType);

  fastify.decorate('files', { service: fS });
};

export default basePlugin;
