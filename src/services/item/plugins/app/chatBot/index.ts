import { FastifyPluginAsync } from 'fastify';

import { buildRepositories } from '../../../../../utils/repositories';
import { ChatBotMessage } from './interfaces/chat-bot-message';
import { create } from './schemas';
import { ChatBotService } from './service';

const chatBotPlugin: FastifyPluginAsync = async (fastify) => {
  const chatBotService = new ChatBotService();

  fastify.register(async function (fastify) {
    fastify.post<{ Params: { itemId: string }; Body: Array<ChatBotMessage> }>(
      '/:itemId/chatbot',
      // TODO: use the schema to validate newer chatgpt prompt
      // {
      //   schema: create,
      // },
      async ({ authTokenSubject: requestDetails, params: { itemId }, body: prompt }, reply) => {
        const member = requestDetails?.memberId;
        const message = await chatBotService.post(member, buildRepositories(), itemId, prompt);
        reply.code(200).send({ completion: message });
      },
    );
  });
};

export default chatBotPlugin;
