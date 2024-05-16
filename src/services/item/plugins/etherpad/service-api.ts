import { v4 } from 'uuid';

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import Etherpad from '@graasp/etherpad-api';

import { InvalidSession } from '../../../../utils/errors';
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
    verifyAuthentication,
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
      fastify.addHook('preHandler', verifyAuthentication);

      /**
       * Etherpad creation
       */
      fastify.post<{ Querystring: { parentId?: string }; Body: { name: string } }>(
        '/create',
        { schema: createEtherpad },
        async (request) => {
          const {
            member,
            query: { parentId },
            body: { name },
          } = request;
          if (!member) {
            throw new InvalidSession();
          }
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
        { schema: getEtherpadFromItem },
        async (request, reply) => {
          const {
            member,
            params: { itemId },
            query: { mode = 'read' },
          } = request;
          if (!member) {
            throw new InvalidSession();
          }

          const { cookie, padUrl } = await etherpadItemService.getEtherpadFromItem(
            member,
            itemId,
            mode,
          );

          await reply.setCookie(cookie.name, cookie.value, cookie.options);
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
