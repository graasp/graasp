import { v4 } from 'uuid';

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { Etherpad } from '@graasp/etherpad-api';

import { notUndefined } from '../../../../utils/assertions.js';
import { isAuthenticated } from '../../../auth/plugins/passport/index.js';
import { ETHERPAD_API_VERSION } from './constants.js';
import { wrapErrors } from './etherpad.js';
import { createEtherpad, getEtherpadFromItem } from './schemas.js';
import { EtherpadItemService } from './service.js';
import { EtherpadPluginOptions } from './types.js';
import { validatePluginOptions } from './utils.js';

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
        { schema: createEtherpad, preHandler: isAuthenticated },
        async (request) => {
          const {
            user,
            query: { parentId },
            body: { name },
          } = request;
          const member = notUndefined(user?.member);
          return await etherpadItemService.createEtherpadItem(member, name, parentId);
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
        { schema: getEtherpadFromItem, preHandler: isAuthenticated },
        async (request, reply) => {
          const {
            user,
            params: { itemId },
            query: { mode = 'read' },
          } = request;
          const member = notUndefined(user?.member);

          const { cookie, padUrl } = await etherpadItemService.getEtherpadFromItem(
            member,
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
