import { FastifyBaseLogger } from 'fastify';

import { ItemType } from '@graasp/sdk';

import {
  FILE_ITEM_PLUGIN_OPTIONS,
  FILE_ITEM_TYPE,
  S3_FILE_ITEM_PLUGIN_OPTIONS,
} from '../../../utils/config';
import FileService from '../service';

const verifyLocalConfig = () => {
  if (
    FILE_ITEM_TYPE === ItemType.LOCAL_FILE &&
    !FILE_ITEM_PLUGIN_OPTIONS?.storageRootPath.startsWith('/')
  ) {
    throw new Error('graasp-plugin-file: local service storageRootPath is malformed');
  }
  if (FILE_ITEM_TYPE === ItemType.LOCAL_FILE && !FILE_ITEM_PLUGIN_OPTIONS?.localFilesHost) {
    throw new Error('graasp-plugin-file: local service localFilesHost is not defined');
  }
};

const verifyS3Config = () => {
  if (FILE_ITEM_TYPE === ItemType.S3_FILE) {
    if (
      !S3_FILE_ITEM_PLUGIN_OPTIONS?.s3Region ||
      !S3_FILE_ITEM_PLUGIN_OPTIONS?.s3Bucket ||
      !S3_FILE_ITEM_PLUGIN_OPTIONS?.s3AccessKeyId ||
      !S3_FILE_ITEM_PLUGIN_OPTIONS?.s3SecretAccessKey
    ) {
      throw new Error('graasp-plugin-file: mandatory options for s3 service missing');
    }
  }
};

export const createfileService = (logger: FastifyBaseLogger) => {
  verifyLocalConfig();
  verifyS3Config();

  return new FileService(
    {
      s3: S3_FILE_ITEM_PLUGIN_OPTIONS,
      local: FILE_ITEM_PLUGIN_OPTIONS,
    },
    FILE_ITEM_TYPE,
    logger,
  );
};
