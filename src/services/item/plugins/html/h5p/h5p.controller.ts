import fs from 'fs';
import path from 'path';

import { fastifyMultipart } from '@fastify/multipart';
import { fastifyStatic } from '@fastify/static';
import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../di/utils';
import { type DBConnection, db } from '../../../../../drizzle/db';
import type { ItemRaw } from '../../../../../drizzle/types';
import type { MaybeUser } from '../../../../../types';
import { asDefined } from '../../../../../utils/assertions';
import { H5P_FILE_STORAGE_TYPE } from '../../../../../utils/config';
import { isAuthenticated, matchOne } from '../../../../auth/plugins/passport';
import { assertIsMember, isMember } from '../../../../authentication';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import { FileStorage } from '../../../../file/types';
import { validatedMemberAccountRole } from '../../../../member/strategies/validatedMemberAccountRole';
import { isItemType } from '../../../discrimination';
import { ItemService } from '../../../item.service';
import type { FastifyStaticReply } from '../types';
import {
  DEFAULT_H5P_ASSETS_ROUTE,
  DEFAULT_H5P_CONTENT_ROUTE,
  MAX_FILES,
  MAX_FILE_SIZE,
  MAX_NON_FILE_FIELDS,
} from './constants';
import { H5PInvalidFileError } from './errors';
import { h5pImport } from './h5p.schemas';
import { H5PService } from './h5p.service';
import { renderHtml } from './integration';
import type { H5PPluginOptions } from './types';

const plugin: FastifyPluginAsyncTypebox<H5PPluginOptions> = async (fastify) => {
  const itemService = resolveDependency(ItemService);
  const h5pService = resolveDependency(H5PService);
  const authorizedItemService = resolveDependency(AuthorizedItemService);

  /**
   * In local storage mode, proxy serve h5p files
   * In the future, consider refactoring the fileService so that it can be grabbed from the
   * core instance and can serve the files directly (with an option to use or not auth)
   */
  if (H5P_FILE_STORAGE_TYPE === FileStorage.Local) {
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
        // todo: temporary value
        [],
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

  fastify.register(fastifyMultipart, {
    limits: {
      fields: MAX_NON_FILE_FIELDS,
      files: MAX_FILES,
      fileSize: MAX_FILE_SIZE,
    },
  });

  fastify.post(
    '/h5p-import',
    {
      schema: h5pImport,
      preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
    },
    async (request) => {
      const {
        user,
        log,
        query: { parentId, previousItemId },
      } = request;
      const member = asDefined(user?.account);
      assertIsMember(member);

      return await db.transaction(async (tx) => {
        // validate write permission in parent if it exists
        if (parentId) {
          await authorizedItemService.assertAccessForItemId(tx, {
            permission: 'write',
            accountId: member.id,
            itemId: parentId,
          });
        }

        // WARNING: cannot destructure { file } = request, which triggers an undefined TypeError internally
        // (maybe getter performs side-effect on promise handler?)
        // so use request.file notation instead
        const h5pFile = await request.file();

        if (!h5pFile) {
          throw new H5PInvalidFileError(h5pFile);
        }

        const { filename, file: stream } = h5pFile;

        return await h5pService.uploadFileAndCreateItem(
          tx,
          member,
          filename,
          stream,
          parentId,
          previousItemId,
          log,
        );
      });
    },
  );

  /**
   * Delete H5P assets on item delete
   */
  itemService.hooks.setPostHook('delete', async (actor, _dbConnection, { item }) => {
    if (!isItemType(item, 'h5p')) {
      return;
    }
    if (!actor) {
      return;
    }
    const { extra } = item;
    await h5pService.deletePackage(extra.h5p.contentId);
  });

  /**
   * Copy H5P assets on item copy
   */
  async function copyH5PAssets(
    actor: MaybeUser,
    dbConnection: DBConnection,
    { original: item, copy }: { original: ItemRaw; copy: ItemRaw },
  ) {
    // only execute this handler for H5P item types
    if (!isItemType(item, 'h5p') || !isItemType(copy, 'h5p')) {
      return;
    }
    if (!actor || !isMember(actor)) {
      return;
    }

    await h5pService.copy(dbConnection, actor, {
      original: item,
      copy: copy,
    });
  }
  itemService.hooks.setPostHook('copy', copyH5PAssets);
};

export default plugin;
