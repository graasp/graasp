/**
 * graasp-plugin-chatbox
 *
 * Fastify plugin for graasp-chatbox
 *
 * Implements back-end functionalities for chatboxes
 * in Graasp as a fastify server plugin
 */
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import { resolveDependency } from '../../di/utils.js';
import { db } from '../../drizzle/db.js';
import { FastifyInstanceTypebox } from '../../plugins/typebox.js';
import { asDefined } from '../../utils/assertions.js';
import {
  isAuthenticated,
  matchOne,
  optionalIsAuthenticated,
} from '../auth/plugins/passport/index.js';
import { ItemService } from '../item/service.js';
import { guestAccountRole } from '../itemLogin/strategies/guestAccountRole.js';
import { validatedMemberAccountRole } from '../member/strategies/validatedMemberAccountRole.js';
import { ChatMessageNotFound } from './errors.js';
import { ActionChatService } from './plugins/action/service.js';
import mentionPlugin from './plugins/mentions/index.js';
import { clearChat, createChatMessage, deleteMessage, getChat, patchMessage } from './schemas.js';
import { ChatMessageService } from './service.js';
import { registerChatWsHooks } from './ws/hooks.js';

/**
 * Type definition for plugin options
 */
export interface GraaspChatPluginOptions {
  prefix?: string;
}

const plugin: FastifyPluginAsyncTypebox<GraaspChatPluginOptions> = async (fastify) => {
  await fastify.register(fp(mentionPlugin));

  const { websockets: websockets } = fastify;

  const itemService = resolveDependency(ItemService);
  const chatService = resolveDependency(ChatMessageService);
  const actionChatService = resolveDependency(ActionChatService);

  // isolate plugin content using fastify.register to ensure that the hooks will not be called when other routes match
  // routes associated with mentions should not trigger the action hook
  fastify.register(async (fastify: FastifyInstanceTypebox) => {
    // register websocket behaviours for chats
    if (websockets) {
      registerChatWsHooks(db, websockets, chatService, itemService);
    }

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
        await db.transaction(async (tx) => {
          const message = await chatService.postOne(tx, account, itemId, body);
          await actionChatService.postPostMessageAction(tx, request, message);
        });
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
        try {
          await db.transaction(async (tx) => {
            const member = asDefined(user?.account);
            const message = await chatService.patchOne(tx, member, itemId, messageId, body);
            await actionChatService.postPatchMessageAction(tx, request, message);
          });
        } catch (e: unknown) {
          throw new ChatMessageNotFound(messageId);
        }
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
        try {
          return await db.transaction(async (tx) => {
            const message = await chatService.deleteOne(tx, member, itemId, messageId);
            await actionChatService.postDeleteMessageAction(tx, request, message);
            return message;
          });
        } catch (e: unknown) {
          throw new ChatMessageNotFound(messageId);
        }
      },
    );

    // clear chat
    fastify.delete(
      '/:itemId/chat',
      {
        schema: clearChat,
        preHandler: [isAuthenticated, matchOne(validatedMemberAccountRole)],
      },
      async (request) => {
        const {
          user,
          params: { itemId },
        } = request;
        const member = asDefined(user?.account);
        await db.transaction(async (tx) => {
          await chatService.clear(tx, member, itemId);
          await actionChatService.postClearMessageAction(tx, request, itemId);
        });
      },
    );
  });
};

export default plugin;
