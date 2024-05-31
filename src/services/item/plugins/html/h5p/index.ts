import fs from 'fs';
import path from 'path';

import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { ItemType, PermissionLevel } from '@graasp/sdk';

import { CLIENT_HOSTS } from '../../../../../utils/config';
import { buildRepositories } from '../../../../../utils/repositories';
import { authenticated } from '../../../../auth/plugins/passport';
import { validatePermission } from '../../../../authorization';
import { Member } from '../../../../member/entities/member';
import { Item, isItemType } from '../../../entities/Item';
import { FastifyStaticReply } from '../types';
import {
  DEFAULT_H5P_ASSETS_ROUTE,
  DEFAULT_H5P_CONTENT_ROUTE,
  MAX_FILES,
  MAX_FILE_SIZE,
  MAX_NON_FILE_FIELDS,
  PLUGIN_NAME,
} from './constants';
import { H5PInvalidFileError } from './errors';
import { renderHtml } from './integration';
import { h5pImport } from './schemas';
import { H5PPluginOptions } from './types';

const plugin: FastifyPluginAsync<H5PPluginOptions> = async (fastify) => {
  // get services from server instance
  const {
    items: { service: itemService },
    h5p: { service: h5pService },
    db,
  } = fastify;

  // question: this is difficult to move this in the service because of the transaction
  /**
   * Creates a Graasp item for the uploaded H5P package
   * @param filename Name of the original H5P file WITHOUT EXTENSION
   * @param contentId Storage ID of the remote content
   * @param remoteRootPath Root path on the remote storage
   * @param member Actor member
   * @param parentId Optional parent id of the newly created item
   */
  async function createH5PItem(
    member: Member,
    filename: string,
    contentId: string,
    parentId?: string,
  ): Promise<Item> {
    const metadata = {
      name: h5pService.buildH5PPath('', filename),
      type: ItemType.H5P,
      extra: h5pService.buildH5PExtra(contentId, filename),
    };
    return db.transaction(async (manager) => {
      return itemService.post(member, buildRepositories(manager), {
        item: metadata,
        parentId,
      });
    });
  }

  /**
   * In local storage mode, proxy serve h5p files
   * In the future, consider refactoring the fileService so that it can be grabbed from the
   * core instance and can serve the files directly (with an option to use or not auth)
   */
  if (h5pService.fileService.type === ItemType.LOCAL_FILE) {
    /** Helper to set CORS headers policy */
    const setHeaders = (response: FastifyStaticReply) => {
      response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    };

    // serve integration html
    const integrationRoute = path.join(DEFAULT_H5P_ASSETS_ROUTE, 'integration.html');
    fastify.get(integrationRoute, async (req, res) => {
      const html = renderHtml(
        DEFAULT_H5P_ASSETS_ROUTE,
        DEFAULT_H5P_CONTENT_ROUTE,
        CLIENT_HOSTS.map(({ url }) => url.hostname) ?? ['localhost'],
      );
      res.send(html);
    });

    // hack to serve the "dist" folder of package "h5p-standalone"
    const h5pAssetsRoot = path.dirname(require.resolve('h5p-standalone'));
    fastify.register(fastifyStatic, {
      root: h5pAssetsRoot,
      prefix: DEFAULT_H5P_ASSETS_ROUTE,
      decorateReply: false,
      setHeaders,
    });

    const h5pStorageRoot = h5pService.buildLocalStorageRoot();
    fs.mkdirSync(h5pStorageRoot, { recursive: true });
    fastify.register(fastifyStatic, {
      root: h5pStorageRoot,
      prefix: DEFAULT_H5P_CONTENT_ROUTE,
      decorateReply: false,
      setHeaders,
    });
  }

  /*
    we create an artificial plugin scope, so that fastify-multipart does not conflict
    with other instances since we use fp to remove the outer scope
  */
  await fastify.register(async (fastify) => {
    fastify.register(fastifyMultipart, {
      limits: {
        fields: MAX_NON_FILE_FIELDS,
        files: MAX_FILES,
        fileSize: MAX_FILE_SIZE,
      },
    });

    /* routes in this scope are authenticated */

    fastify.post<{ Querystring: { parentId?: string } }>(
      '/h5p-import',
      { schema: h5pImport, preHandler: authenticated },
      async (request) => {
        const {
          user,
          log,
          query: { parentId },
        } = request;
        const member = user!.member!;
        return db.transaction(async (manager) => {
          const repositories = buildRepositories(manager);

          // validate write permission in parent if it exists
          if (parentId) {
            const item = await itemService.get(member, repositories, parentId);
            await validatePermission(repositories, PermissionLevel.Write, member, item);
          }

          // WARNING: cannot destructure { file } = request, which triggers an undefined TypeError internally
          // (maybe getter performs side-effect on promise handler?)
          // so use request.file notation instead
          const h5pFile = await request.file();

          if (!h5pFile) {
            throw new H5PInvalidFileError(h5pFile);
          }

          return h5pService.createItem(member, repositories, h5pFile, createH5PItem, parentId, log);
        });
      },
    );
  });

  /**
   * Delete H5P assets on item delete
   */
  itemService.hooks.setPostHook('delete', async (actor, repositories, { item }) => {
    if (!isItemType(item, ItemType.H5P)) {
      return;
    }
    if (!actor) {
      return;
    }
    const { extra } = item;
    await h5pService.deletePackage(actor, extra.h5p.contentId);
  });

  /**
   * Copy H5P assets on item copy
   */
  itemService.hooks.setPostHook('copy', async (actor, repositories, { original: item, copy }) => {
    // only execute this handler for H5P item types
    if (!isItemType(item, ItemType.H5P) || !isItemType(copy, ItemType.H5P)) {
      return;
    }
    if (!actor) {
      return;
    }

    await h5pService.copy(actor, repositories, {
      original: item,
      copy: copy,
    });
  });
};

export default fp(plugin, {
  fastify: '4.x',
  name: PLUGIN_NAME,
});
