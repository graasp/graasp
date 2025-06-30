/**
 * Fastify plugin for graasp-chatbox
 *
 * Implements back-end functionalities for chatboxes
 * in Graasp as a fastify server plugin
 */
import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import type { FastifyInstanceTypebox } from '../../plugins/typebox';
import { asDefined } from '../../utils/assertions';
import { isAuthenticated, matchOne, optionalIsAuthenticated } from '../auth/plugins/passport';
import { AuthorizedItemService } from '../authorizedItem.service';
import { guestAccountRole } from '../itemLogin/strategies/guestAccountRole';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole';
import {
  clearChat,
  createChatMessage,
  deleteMessage,
  getChat,
  patchMessage,
} from './chatMessage.schemas';
import { ChatMessageService } from './chatMessage.service';
import { ActionChatService } from './plugins/action/chatAction.service';
import mentionPlugin from './plugins/mentions/chatMention.controller';
import { ItemChatEvent, itemChatTopic } from './ws/events';

/**
 * Type definition for plugin options
 */
export interface GraaspChatPluginOptions {
  prefix?: string;
}

const plugin: FastifyPluginAsyncTypebox<GraaspChatPluginOptions> = async (fastify) => {
  await fastify.register(fp(mentionPlugin));

  const authorizedItemService = resolveDependency(AuthorizedItemService);
  const chatService = resolveDependency(ChatMessageService);
  const actionChatService = resolveDependency(ActionChatService);

  // isolate plugin content using fastify.register to ensure that the hooks will not be called when other routes match
  // routes associated with mentions should not trigger the action hook
  fastify.register(async (fastify: FastifyInstanceTypebox) => {
    // register websockets
    const { websockets } = fastify;
    websockets.register(itemChatTopic, async (req) => {
      const { channel: itemId, member } = req;
      // item must exist with read permission, else exception is thrown
      await authorizedItemService.assertAccessForItemId(db, { accountId: member?.id, itemId });
    });

    fastify.get(
      '/:itemId/chat',
      { schema: getChat, preHandler: optionalIsAuthenticated },
      async ({ user, params: { itemId } }) => {
        return await chatService.getForItem(db, user?.account, itemId);
      },
    );

    fastify.post(
      '/:itemId/chat',
      {
        schema: createChatMessage,
        preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole, guestAccountRole)],
      },
      async (request) => {
        const {
          user,
          params: { itemId },
          body,
        } = request;
        const account = asDefined(user?.account);
        const message = await db.transaction(async (tx) => {
          const message = await chatService.postOne(tx, account, itemId, body);
          await actionChatService.postPostMessageAction(tx, request, message);
          return message;
        });

        // websocket message
        try {
          websockets.publish(itemChatTopic, message.itemId, ItemChatEvent('publish', message));
        } catch (e) {
          request.log.error(e);
        }

        return message;
      },
    );

    /**
     * Patch Chat Message
     * ignore mentions
     *  */
    fastify.patch(
      '/:itemId/chat/:messageId',
      {
        schema: patchMessage,
        preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole, guestAccountRole)],
      },
      async (request) => {
        const {
          user,
          params: { itemId, messageId },
          body,
        } = request;
        const message = await db.transaction(async (tx) => {
          const member = asDefined(user?.account);
          const message = await chatService.patchOne(tx, member, itemId, messageId, body);
          await actionChatService.postPatchMessageAction(tx, request, message);
          return message;
        });

        // websocket message
        try {
          websockets.publish(itemChatTopic, message.itemId, ItemChatEvent('update', message));
        } catch (e) {
          request.log.error(e);
        }

        return message;
      },
    );

    // delete message
    fastify.delete(
      '/:itemId/chat/:messageId',
      {
        schema: deleteMessage,
        preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole, guestAccountRole)],
      },
      async (request) => {
        const {
          user,
          params: { itemId, messageId },
        } = request;
        const member = asDefined(user?.account);
        const message = await db.transaction(async (tx) => {
          const message = await chatService.deleteOne(tx, member, itemId, messageId);
          await actionChatService.postDeleteMessageAction(tx, request, message);
          return message;
        });

        // websocket message
        try {
          websockets.publish(itemChatTopic, message.itemId, ItemChatEvent('delete', message));
        } catch (e) {
          request.log.error(e);
        }

        return message;
      },
    );

    // clear chat
    fastify.delete(
      '/:itemId/chat',
      {
        schema: clearChat,
        preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      },
      async (request, reply) => {
        const {
          user,
          params: { itemId },
        } = request;
        const member = asDefined(user?.account);
        await db.transaction(async (tx) => {
          await chatService.clear(tx, member, itemId);
          await actionChatService.postClearMessageAction(tx, request, itemId);
        });
        reply.status(StatusCodes.NO_CONTENT);

        // websocket message
        try {
          websockets.publish(itemChatTopic, itemId, ItemChatEvent('clear'));
        } catch (e) {
          request.log.error(e);
        }
      },
    );
  });
};

export default plugin;
