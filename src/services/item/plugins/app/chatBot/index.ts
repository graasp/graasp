import { FastifyPluginAsync } from 'fastify';

import { ChatBotMessage } from '@graasp/sdk';

import { buildRepositories } from '../../../../../utils/repositories';
import { GPTVersion } from './interfaces/gptVersion';
import { create } from './schemas';
import { ChatBotService } from './service';

type QueryParameters = {
  'gpt-version': GPTVersion;
};

const chatBotPlugin: FastifyPluginAsync = async (fastify) => {
  const chatBotService = new ChatBotService();

  fastify.register(async function (fastify) {
    fastify.post<{
      Params: { itemId: string };
      Body: Array<ChatBotMessage>;
      QueryString: QueryParameters;
    }>(
      '/:itemId/chat-bot',
      {
        schema: create,
      },
      async (
        { authTokenSubject: requestDetails, params: { itemId }, body: prompt, query },
        reply,
      ) => {
        const gptVersion = (query as QueryParameters)['gpt-version'];
        const member = requestDetails?.memberId;
        const message = await chatBotService.post(
          member,
          buildRepositories(),
          itemId,
          prompt,
          gptVersion,
        );
        reply.code(200).send({ completion: message.completion, model: message.model });
      },
    );
  });
};

export default chatBotPlugin;
