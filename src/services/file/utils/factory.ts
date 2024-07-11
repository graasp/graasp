import { FileItemType, ItemType } from '@graasp/sdk';

import { LocalFileConfiguration, S3FileConfiguration } from '../interfaces/configuration';
import { LocalFileRepository } from '../repositories/local';
import { S3FileRepository } from '../repositories/s3';
import { FileServiceConfig } from '../service';
import { MalformedFileConfigError } from './errors';

const verifyLocalConfig = (config?: LocalFileConfiguration) => {
  if (!config?.storageRootPath.startsWith('/')) {
    throw new MalformedFileConfigError(
      'graasp-plugin-file: local service storageRootPath is malformed',
    );
  }

  if (!config?.localFilesHost) {
    throw new MalformedFileConfigError(
      'graasp-plugin-file: local service localFilesHost is not defined',
    );
  }

  return config;
};

const verifyS3Config = (config?: S3FileConfiguration) => {
  if (
    !config?.s3Region ||
    !config?.s3Bucket ||
    !config?.s3AccessKeyId ||
    !config?.s3SecretAccessKey
  ) {
    throw new MalformedFileConfigError(
      'graasp-plugin-file: mandatory options for s3 service missing',
    );
  }

  return config;
};

export const fileRepositoryFactory = (fileItemType: FileItemType, config: FileServiceConfig) => {
  switch (fileItemType) {
    case ItemType.S3_FILE: {
      const s3Config = verifyS3Config(config.s3);
      return new S3FileRepository(s3Config);
    }
    case ItemType.LOCAL_FILE:
    default: {
      const localConfig = verifyLocalConfig(config.local);
      return new LocalFileRepository(localConfig);
    }
  }
};
