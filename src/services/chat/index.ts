/**
 * graasp-plugin-chatbox
 *
 * Fastify plugin for graasp-chatbox
 *
 * Implements back-end functionalities for chatboxes
 * in Graasp as a fastify server plugin
 */
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { resolveDependency } from '../../di/utils';
import { notUndefined } from '../../utils/assertions';
import { buildRepositories } from '../../utils/repositories';
import { isAuthenticated, optionalIsAuthenticated } from '../auth/plugins/passport';
import { matchOne } from '../authorization';
import { ItemService } from '../item/service';
import { validatedMember } from '../member/strategies/validatedMember';
import { ActionChatService } from './plugins/action/service';
import mentionPlugin from './plugins/mentions';
import commonChat, {
  clearChat,
  deleteMessage,
  getChat,
  patchMessage,
  publishMessage,
} from './schemas';
import { ChatMessageService } from './service';
import { registerChatWsHooks } from './ws/hooks';

/**
 * Type definition for plugin options
 */
export interface GraaspChatPluginOptions {
  prefix?: string;
}

const plugin: FastifyPluginAsync<GraaspChatPluginOptions> = async (fastify) => {
  await fastify.addSchema(commonChat);

  await fastify.register(fp(mentionPlugin));

  const { db, websockets: websockets } = fastify;

  const itemService = resolveDependency(ItemService);
  const chatService = resolveDependency(ChatMessageService);
  const actionChatService = resolveDependency(ActionChatService);

  // isolate plugin content using fastify.register to ensure that the hooks will not be called when other routes match
  // routes associated with mentions should not trigger the action hook
  fastify.register(async function (fastify) {
    // register websocket behaviours for chats
    if (websockets) {
      registerChatWsHooks(buildRepositories(), websockets, chatService, itemService);
    }

    fastify.get<{ Params: { itemId: string } }>(
      '/:itemId/chat',
      { schema: getChat, preHandler: optionalIsAuthenticated },
      async ({ user, params: { itemId } }) => {
        return chatService.getForItem(user?.member, buildRepositories(), itemId);
      },
    );

    fastify.post<{
      Params: { itemId: string };
      Body: { body: string; mentions: string[] };
    }>(
      '/:itemId/chat',
      {
        schema: publishMessage,
        preHandler: [isAuthenticated, matchOne(validatedMember)],
      },
      async (request) => {
        const {
          user,
          params: { itemId },
          body,
        } = request;
        const member = notUndefined(user?.member);
        return await db.transaction(async (manager) => {
          const repositories = buildRepositories(manager);
          const message = await chatService.postOne(member, repositories, itemId, body);
          await actionChatService.postPostMessageAction(request, repositories, message);
          return message;
        });
      },
    );

    /**
     * Patch Chat Message
     * ignore mentions
     *  */
    fastify.patch<{
      Params: { itemId: string; messageId: string };
      Body: { body: string };
    }>(
      '/:itemId/chat/:messageId',
      {
        schema: patchMessage,
        preHandler: [isAuthenticated, matchOne(validatedMember)],
      },
      async (request) => {
        const {
          user,
          params: { itemId, messageId },
          body,
        } = request;
        return await db.transaction(async (manager) => {
          const member = notUndefined(user?.member);
          const repositories = buildRepositories(manager);
          const message = await chatService.patchOne(member, repositories, itemId, messageId, body);
          await actionChatService.postPatchMessageAction(request, repositories, message);
          return message;
        });
      },
    );

    // delete message
    fastify.delete<{ Params: { itemId: string; messageId: string } }>(
      '/:itemId/chat/:messageId',
      {
        schema: deleteMessage,
        preHandler: [isAuthenticated, matchOne(validatedMember)],
      },
      async (request) => {
        const {
          user,
          params: { itemId, messageId },
        } = request;
        const member = notUndefined(user?.member);
        return await db.transaction(async (manager) => {
          const repositories = buildRepositories(manager);
          const message = await chatService.deleteOne(member, repositories, itemId, messageId);
          await actionChatService.postDeleteMessageAction(request, repositories, message);
          return message;
        });
      },
    );

    // clear chat
    fastify.delete<{ Params: { itemId: string } }>(
      '/:itemId/chat',
      {
        schema: clearChat,
        preHandler: [isAuthenticated, matchOne(validatedMember)],
      },
      async (request) => {
        const {
          user,
          params: { itemId },
        } = request;
        const member = notUndefined(user?.member);
        await db.transaction(async (manager) => {
          const repositories = buildRepositories(manager);
          await chatService.clear(member, repositories, itemId);
          await actionChatService.postClearMessageAction(request, repositories, itemId);
        });

        return;
      },
    );
  });
};

export default plugin;
