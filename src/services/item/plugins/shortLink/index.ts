import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { ShortLinkAvailable, ShortLinkPatchPayload, ShortLinkPostPayload } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { authenticated } from '../../../auth/plugins/passport';
import { create, restricted_get, update } from './schemas';
import { SHORT_LINKS_LIST_ROUTE, ShortLinkService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    db,
    items: { service: itemService },
    itemsPublished: { service: itemPublishedService },
  } = fastify;

  const shortLinkService = new ShortLinkService(itemService, itemPublishedService);
  fastify.register(async function (fastify) {
    // No need to be logged for the redirection
    fastify.get<{ Params: { alias: string } }>('/:alias', async ({ params: { alias } }, reply) => {
      const path = await shortLinkService.getRedirection(buildRepositories(), alias);
      reply.code(StatusCodes.MOVED_TEMPORARILY).redirect(path);
    });

    // WARNING: Do not return the entire item, because this route is not protected !
    // the restricted_get schema filter all item's fields except the id.
    fastify.get<{ Params: { alias: string } }>(
      '/alias/:alias',
      {
        schema: restricted_get,
      },
      async ({ params: { alias } }) => {
        return await shortLinkService.getOneWithoutJoin(buildRepositories(), alias);
      },
    );

    fastify.get<{ Params: { alias: string } }>(
      '/available/:alias',
      async ({ params: { alias } }) => {
        try {
          await shortLinkService.getOne(buildRepositories(), alias);
          return { available: false } as ShortLinkAvailable;
        } catch (e) {
          return { available: true } as ShortLinkAvailable;
        }
      },
    );

    // Only the admin can manage a short link of this resource
    // or list all the shortlinks associated to this resource
    await fastify.register(async (fastify) => {
      fastify.get<{ Params: { itemId: string } }>(
        `${SHORT_LINKS_LIST_ROUTE}/:itemId`,
        { preHandler: authenticated },
        async ({ user, params: { itemId } }) => {
          return shortLinkService.getAllForItem(user!.member!, buildRepositories(), itemId);
        },
      );

      fastify.post<{ Body: ShortLinkPostPayload }>(
        '/',
        {
          schema: create,
          preHandler: authenticated,
        },
        async ({ user, body: shortLink }) => {
          if (!user) {
            throw new UnauthorizedMember();
          }

          return db.transaction(async (manager) => {
            const newLink = await shortLinkService.post(
              user!.member!,
              buildRepositories(manager),
              shortLink,
            );
            return newLink;
          });
        },
      );

      fastify.delete<{ Params: { alias: string } }>(
        '/:alias',
        { preHandler: authenticated },
        async ({ user, params: { alias } }) => {
          return db.transaction(async (manager) => {
            const oldLink = await shortLinkService.delete(
              user!.member!,
              buildRepositories(manager),
              alias,
            );
            return oldLink;
          });
        },
      );

      fastify.patch<{ Params: { alias: string }; Body: ShortLinkPatchPayload }>(
        '/:alias',
        {
          schema: update,
          preHandler: authenticated,
        },
        async ({ user, body: shortLink, params: { alias } }) => {
          return db.transaction(async (manager) => {
            const updatedLink = await shortLinkService.update(
              user!.member!,
              buildRepositories(manager),
              alias,
              shortLink,
            );
            return updatedLink;
          });
        },
      );
    });
  });
};

export default plugin;
