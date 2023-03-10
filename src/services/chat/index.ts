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

import { Hostname } from '@graasp/sdk';

// import {
//   ActionHandlerInput,
//   ActionService,
//   ActionTaskManager,
//   BaseAction,
// } from 'graasp-plugin-actions';
import { buildRepositories } from '../../util/repositories';
import mentionPlugin from './plugins/mentions';
import commonChat, {
  clearChat,
  deleteMessage,
  getChat,
  patchMessage,
  publishMessage,
} from './schemas';
// import { registerChatWsHooks } from './ws/hooks';
// import { ChatMessage } from './chatMessage';
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
    mentions: { service: mentionService },
  } = fastify;

  const chatService = new ChatMessageService(mentionService);

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

    // add actions
    // const actionService = new ActionService();

    // fastify.addHook('onSend', async (request, reply, payload) => {
    //   // todo: save public actions?
    //   if (request.member) {
    //     // wrap the createItemActionHandler in a new function to provide it with the properties we already have
    //     // todo: make better types -> use graasp constants or graasp types
    //     const actionHandler = (
    //       actionInput: ActionHandlerInput,
    //     ): Promise<BaseAction[]> =>
    //       createChatActionHandler(
    //         itemService,
    //         payload as string,
    //         actionInput,
    //         options.hosts,
    //       );
    //     const createActionTask = actionTaskManager.createCreateTask(
    //       request.member,
    //       {
    //         request,
    //         reply,
    //         handler: actionHandler,
    //       },
    //     );
    //     await runner.runSingle(createActionTask);
    //   }
    // });

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
      { schema: publishMessage, preHandler: fastify.verifyAuthentication },
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
      { schema: patchMessage, preHandler: fastify.verifyAuthentication },
      async ({ member, params: { itemId, messageId }, body, log }) => {
        return db.transaction(async (manager) => {
          return chatService.patchOne(member, buildRepositories(manager), itemId, messageId, body);
        });
      },
    );

    // delete message
    fastify.delete<{ Params: { itemId: string; messageId: string } }>(
      '/:itemId/chat/:messageId',
      { schema: deleteMessage, preHandler: fastify.verifyAuthentication },
      async ({ member, params: { itemId, messageId }, log }) => {
        return db.transaction(async (manager) => {
          return chatService.deleteOne(member, buildRepositories(manager), itemId, messageId);
        });
      },
    );

    // clear chat
    fastify.delete<{ Params: { itemId: string } }>(
      '/:itemId/chat',
      { schema: clearChat, preHandler: fastify.verifyAuthentication },
      async ({ member, params: { itemId }, log }) => {
        return db.transaction(async (manager) => {
          return chatService.clear(member, buildRepositories(manager), itemId);
        });
      },
    );
  });
};

export default fp(plugin, {
  fastify: '4.x',
  name: 'graasp-plugin-chatbox',
});
