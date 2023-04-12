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

import { buildRepositories } from '../../util/repositories';
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

/**
 * Type definition for plugin options
 */
export interface GraaspChatPluginOptions {
  prefix?: string;
}

const plugin: FastifyPluginAsync<GraaspChatPluginOptions> = async (fastify, options) => {
  await fastify.register(fp(mentionPlugin));

  const {
    db,
    actions: { service: actionService },
    mentions: { service: mentionService },
  } = fastify;

  const chatService = new ChatMessageService(mentionService);
  const actionChatService = new ActionChatService(actionService);

  // isolate plugin content using fastify.register to ensure that the hooks will not be called when other routes match
  // routes associated with mentions should not trigger the action hook
  fastify.register(async function (fastify) {
    fastify.addSchema(commonChat);

    // register websocket behaviours for chats
    // if (websockets) {
    //   registerChatWsHooks(
    //     websockets,
    //     runner,
    //     itemService,
    //     itemMembershipsService,
    //     taskManager,
    //     db.pool,
    //   );
    // }

    fastify.get<{ Params: { itemId: string } }>(
      '/:itemId/chat',
      { schema: getChat, preHandler: fastify.fetchMemberInSession },
      async ({ member, params: { itemId }, log }) => {
        return chatService.getForItem(member, buildRepositories(), itemId);
      },
    );

    fastify.post<{
      Params: { itemId: string };
      Body: { body: string; mentions: string[] };
    }>(
      '/:itemId/chat',
      {
        schema: publishMessage,
        preHandler: fastify.verifyAuthentication,
        onSend: actionChatService.postPostMessageAction,
      },
      async ({ member, params: { itemId }, body, log }) => {
        return db.transaction(async (manager) => {
          return chatService.postOne(member, buildRepositories(manager), itemId, body);
        });
      },
    );

    // patch message
    fastify.patch<{
      Params: { itemId: string; messageId: string };
      Body: { body: string };
    }>(
      '/:itemId/chat/:messageId',
      {
        schema: patchMessage,
        preHandler: fastify.verifyAuthentication,
        onSend: actionChatService.postPatchMessageAction,
      },
      async ({ member, params: { itemId, messageId }, body, log }) => {
        return db.transaction(async (manager) => {
          return chatService.patchOne(member, buildRepositories(manager), itemId, messageId, body);
        });
      },
    );

    // delete message
    fastify.delete<{ Params: { itemId: string; messageId: string } }>(
      '/:itemId/chat/:messageId',
      {
        schema: deleteMessage,
        preHandler: fastify.verifyAuthentication,
        onSend: actionChatService.postDeleteMessageAction,
      },
      async ({ member, params: { itemId, messageId }, log }) => {
        return db.transaction(async (manager) => {
          return chatService.deleteOne(member, buildRepositories(manager), itemId, messageId);
        });
      },
    );

    // clear chat
    fastify.delete<{ Params: { itemId: string } }>(
      '/:itemId/chat',
      {
        schema: clearChat,
        preHandler: fastify.verifyAuthentication,
        onSend: actionChatService.postClearMessageAction,
      },
      async ({ member, params: { itemId }, log }) => {
        return db.transaction(async (manager) => {
          return chatService.clear(member, buildRepositories(manager), itemId);
        });
      },
    );
  });
};

export default plugin;
