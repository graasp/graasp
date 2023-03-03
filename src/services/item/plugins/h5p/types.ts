import { FileItemType, LocalFileConfiguration, S3FileConfiguration } from '@graasp/sdk';

/**
 * Plugin options
 */
export interface H5PPluginOptions {
  /** storage type */
  fileItemType: FileItemType;
  /** storage options, given storage type */
  fileConfigurations: { s3: S3FileConfiguration; local: LocalFileConfiguration };
  /** path prefix of H5P content on storage */
  pathPrefix: string;
  /** optional: if serviceMethod is set to 'local', H5P assets and content will be mounted at the following routes (relative to the mount point of this plugin) otherwise defaults are used {@link file://./constants.ts} */
  routes?: {
    assets: string;
    content: string;
  };
  /** optional: if serviceMethod is set to 'local', H5P integration will be mounted at <host>/<routes.assets>/integration.html */
  host?: string;
  /** optional: temp directory */
  tempDir?: string;
}

/** Helper type for fastify-static */
export interface FastifyStaticReply {
  setHeader: (key: string, value: string) => void;
}
