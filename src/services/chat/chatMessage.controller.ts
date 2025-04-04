/**
 * graasp-plugin-chatbox
 *
 * Fastify plugin for graasp-chatbox
 *
 * Implements back-end functionalities for chatboxes
 * in Graasp as a fastify server plugin
 */
import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import fp from 'fastify-plugin';

import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import { FastifyInstanceTypebox } from '../../plugins/typebox';
import { asDefined } from '../../utils/assertions';
import { isAuthenticated, matchOne, optionalIsAuthenticated } from '../auth/plugins/passport';
import { ItemService } from '../item/item.service';
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
import { registerChatWsHooks } from './ws/hooks';

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
        return await db.transaction(async (tx) => {
          const message = await chatService.postOne(tx, account, itemId, body);
          await actionChatService.postPostMessageAction(tx, request, message);
          return message;
        });
        // TODO: move websockets here so it stays consitent when the transaction fails for example.
        // it will also allow to remove the need for a post-hook and make it explicit after the business has been done.
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
        return await db.transaction(async (tx) => {
          const member = asDefined(user?.account);
          const message = await chatService.patchOne(tx, member, itemId, messageId, body);
          await actionChatService.postPatchMessageAction(tx, request, message);
          return message;
        });
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
        return await db.transaction(async (tx) => {
          const message = await chatService.deleteOne(tx, member, itemId, messageId);
          await actionChatService.postDeleteMessageAction(tx, request, message);
          return message;
        });
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
      },
    );
  });
};

export default plugin;
