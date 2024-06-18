/**
 * Plugin options
 */
export type H5PPluginOptions = {
  /** optional: if serviceMethod is set to 'local', H5P assets and content will be mounted at the following routes (relative to the mount point of this plugin) otherwise defaults are used {@link file://./constants.ts} */
  routes?: {
    assets: string;
    content: string;
  };
  /** optional: temp directory */
  tempDir?: string;
};
