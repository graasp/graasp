import { v4 } from 'uuid';

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import Etherpad from '@graasp/etherpad-api';

import { authenticated } from '../../../auth/plugins/passport';
import { ETHERPAD_API_VERSION } from './constants';
import { wrapErrors } from './etherpad';
import { createEtherpad, getEtherpadFromItem } from './schemas';
import { EtherpadItemService } from './service';
import { EtherpadPluginOptions } from './types';
import { validatePluginOptions } from './utils';

const plugin: FastifyPluginAsync<EtherpadPluginOptions> = async (fastify, options) => {
  // get services from server instance
  const {
    items: { service: itemService },
    log,
  } = fastify;

  const { url: etherpadUrl, publicUrl, apiKey, cookieDomain } = validatePluginOptions(options);

  // connect to etherpad server
  const etherpad = wrapErrors(
    new Etherpad({
      url: etherpadUrl,
      apiKey,
      apiVersion: ETHERPAD_API_VERSION,
    }),
  );

  const etherpadItemService = new EtherpadItemService(
    etherpad,
    () => v4(),
    publicUrl,
    cookieDomain,
    itemService,
    log,
  );
  fastify.decorate('etherpad', etherpadItemService);

  // create a route prefix for etherpad
  await fastify.register(
    async (fastify: FastifyInstance) => {
      /**
       * Etherpad creation
       */
      fastify.post<{ Querystring: { parentId?: string }; Body: { name: string } }>(
        '/create',
        { schema: createEtherpad, preHandler: authenticated },
        async (request) => {
          const {
            user,
            query: { parentId },
            body: { name },
          } = request;
          return await etherpadItemService.createEtherpadItem(user!.member!, name, parentId);
        },
      );

      /**
       * Etherpad view in given mode (read or write)
       * Access should be granted if and only if the user has at least write
       * access to the item. If user only has read permission, then the pad
       * should be displayed in read-only mode
       */
      fastify.get<{ Params: { itemId: string }; Querystring: { mode?: 'read' | 'write' } }>(
        '/view/:itemId',
        { schema: getEtherpadFromItem, preHandler: authenticated },
        async (request, reply) => {
          const {
            user,
            params: { itemId },
            query: { mode = 'read' },
          } = request;

          const { cookie, padUrl } = await etherpadItemService.getEtherpadFromItem(
            user!.member!,
            itemId,
            mode,
          );

          reply.setCookie(cookie.name, cookie.value, cookie.options);
          return { padUrl };
        },
      );

      /**
       * Delete etherpad on item delete
       */
      itemService.hooks.setPreHook('delete', async (actor, repositories, { item }) => {
        if (!actor) {
          return;
        }
        await etherpadItemService.deleteEtherpadForItem(actor, item);
      });

      /**
       * Copy etherpad on item copy
       */
      itemService.hooks.setPreHook('copy', async (actor, repositories, { original: item }) => {
        if (!actor) {
          return;
        }
        await etherpadItemService.copyEtherpadInMutableItem(actor, item);
      });
    },
    { prefix: 'etherpad' },
  );
};

export default fp(plugin, {
  name: 'graasp-plugin-etherpad',
});
