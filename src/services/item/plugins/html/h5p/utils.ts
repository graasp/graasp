import { H5PPluginOptions } from './types';

/**
 * Helper to check the plugin options
 * Throws if an error is encountered
 */
export function validatePluginOptions(options: H5PPluginOptions) {
  const { fileStorage, routes } = options;
  const { pathPrefix } = fileStorage;

  if (pathPrefix && pathPrefix.startsWith('/')) {
    throw new Error('H5P path prefix should not start with a "/"!');
  }

  if (routes) {
    Object.values(routes).forEach((route) => {
      if (!route.startsWith('/') || !route.endsWith('/')) {
        throw new Error("H5P routes must start and end with a forward slash ('/') !");
      }
    });
  }
}
