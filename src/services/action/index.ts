import { FastifyPluginAsync } from 'fastify';

import { FileItemType, LocalFileConfiguration, S3FileConfiguration } from '@graasp/sdk';

export interface GraaspActionsOptions {
  shouldSave?: boolean;
  fileItemType: FileItemType;
  fileConfigurations: { s3: S3FileConfiguration; local: LocalFileConfiguration };
}

const plugin: FastifyPluginAsync<GraaspActionsOptions> = async (fastify, options) => {
  // TODO post action endpoint
};

export default plugin;
