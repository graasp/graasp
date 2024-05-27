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

import { buildRepositories } from '../../utils/repositories';
import { authenticated, optionalAuthenticated } from '../auth/plugins/passport';
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

  const {
    db,
    actions: { service: actionService },
    mentions: { service: mentionService },
    items: { service: itemService },
    websockets: websockets,
  } = fastify;

  const chatService = new ChatMessageService(itemService, mentionService);
  const actionChatService = new ActionChatService(actionService);

  fastify.decorate('chat', { service: chatService });

  // isolate plugin content using fastify.register to ensure that the hooks will not be called when other routes match
  // routes associated with mentions should not trigger the action hook
  fastify.register(async function (fastify) {
    // register websocket behaviours for chats
    if (websockets) {
      registerChatWsHooks(buildRepositories(), websockets, chatService, itemService);
    }

    fastify.get<{ Params: { itemId: string } }>(
      '/:itemId/chat',
      { schema: getChat, preHandler: optionalAuthenticated },
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
        preHandler: authenticated,
      },
      async (request, reply) => {
        const {
          user,
          params: { itemId },
          body,
        } = request;
        return await db.transaction(async (manager) => {
          const repositories = buildRepositories(manager);
          const message = await chatService.postOne(user!.member!, repositories, itemId, body);
          await actionChatService.postPostMessageAction(request, reply, repositories, message);
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
        preHandler: authenticated,
      },
      async (request, reply) => {
        const {
          user,
          params: { itemId, messageId },
          body,
        } = request;
        return await db.transaction(async (manager) => {
          const repositories = buildRepositories(manager);
          const message = await chatService.patchOne(
            user!.member!,
            repositories,
            itemId,
            messageId,
            body,
          );
          await actionChatService.postPatchMessageAction(request, reply, repositories, message);
          return message;
        });
      },
    );

    // delete message
    fastify.delete<{ Params: { itemId: string; messageId: string } }>(
      '/:itemId/chat/:messageId',
      {
        schema: deleteMessage,
        preHandler: authenticated,
      },
      async (request, reply) => {
        const {
          user,
          params: { itemId, messageId },
        } = request;
        return await db.transaction(async (manager) => {
          const repositories = buildRepositories(manager);
          const message = await chatService.deleteOne(
            user!.member!,
            repositories,
            itemId,
            messageId,
          );
          await actionChatService.postDeleteMessageAction(request, reply, repositories, message);
          return message;
        });
      },
    );

    // clear chat
    fastify.delete<{ Params: { itemId: string } }>(
      '/:itemId/chat',
      {
        schema: clearChat,
        preHandler: authenticated,
      },
      async (request, reply) => {
        const {
          user,
          params: { itemId },
        } = request;
        await db.transaction(async (manager) => {
          const repositories = buildRepositories(manager);
          await chatService.clear(user!.member!, repositories, itemId);
          await actionChatService.postClearMessageAction(request, reply, repositories, itemId);
        });

        return;
      },
    );
  });
};

export default plugin;
