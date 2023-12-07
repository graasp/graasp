import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsync } from 'fastify';

import { ShortLinkAvailable, ShortLinkPatchPayload, ShortLinkPostPayload } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
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

    // WARNING: Do not return the entire item, because this route is no protected !
    // the restricted_get schema filter all item's fields except the id.
    fastify.get<{ Params: { alias: string } }>(
      '/short-link/:alias',
      {
        schema: restricted_get,
      },
      async ({ params: { alias } }) => {
        return await shortLinkService.getOne(buildRepositories(), alias);
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
      fastify.addHook('preHandler', fastify.verifyAuthentication);

      fastify.get<{ Params: { itemId: string } }>(
        `${SHORT_LINKS_LIST_ROUTE}/:itemId`,
        async ({ member, params: { itemId } }) => {
          if (!member) {
            throw new UnauthorizedMember();
          }

          return shortLinkService.getAllForItem(member, buildRepositories(), itemId);
        },
      );

      fastify.post<{ Body: ShortLinkPostPayload }>(
        '/',
        {
          schema: create,
        },
        async ({ member, body: shortLink }) => {
          if (!member) {
            throw new UnauthorizedMember();
          }

          return db.transaction(async (manager) => {
            const newLink = await shortLinkService.post(
              member,
              buildRepositories(manager),
              shortLink,
            );
            return newLink;
          });
        },
      );

      fastify.delete<{ Params: { alias: string } }>(
        '/:alias',
        async ({ member, params: { alias } }) => {
          if (!member) {
            throw new UnauthorizedMember();
          }

          return db.transaction(async (manager) => {
            const oldLink = await shortLinkService.delete(
              member,
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
        },
        async ({ member, body: shortLink, params: { alias } }) => {
          if (!member) {
            throw new UnauthorizedMember();
          }

          return db.transaction(async (manager) => {
            const updatedLink = await shortLinkService.update(
              member,
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
