import { FastifyPluginAsync } from 'fastify';

import { FileItemType, ItemType } from '@graasp/sdk';

import { LocalFileConfiguration, S3FileConfiguration } from './interfaces/configuration.js';
import FileService from './service.js';

export interface GraaspPluginFileOptions {
  fileItemType: FileItemType; // S3 or local

  fileConfigurations: {
    s3?: S3FileConfiguration;
    local?: LocalFileConfiguration;
  };
}

const basePlugin: FastifyPluginAsync<GraaspPluginFileOptions> = async (fastify, options) => {
  const { fileItemType, fileConfigurations } = options;

  if (
    fileItemType === ItemType.LOCAL_FILE &&
    !fileConfigurations?.local?.storageRootPath.startsWith('/')
  ) {
    throw new Error('graasp-plugin-file: local service storageRootPath is malformed');
  }
  if (fileItemType === ItemType.LOCAL_FILE && !fileConfigurations?.local?.localFilesHost) {
    throw new Error('graasp-plugin-file: local service localFilesHost is not defined');
  }

  if (fileItemType === ItemType.S3_FILE) {
    if (
      !fileConfigurations?.s3?.s3Region ||
      !fileConfigurations?.s3?.s3Bucket ||
      !fileConfigurations?.s3?.s3AccessKeyId ||
      !fileConfigurations?.s3?.s3SecretAccessKey
    ) {
      throw new Error('graasp-plugin-file: mandatory options for s3 service missing');
    }
  }

  const fS = new FileService(fileConfigurations, fileItemType, fastify.log);

  fastify.decorate('files', { service: fS });
};

export default basePlugin;
