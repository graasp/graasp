import { FastifyPluginAsync } from 'fastify';

import { ChatBotMessage, GPTVersion } from '@graasp/sdk';

import { OPENAI_GPT_VERSION } from '../../../../../utils/config';
import { buildRepositories } from '../../../../../utils/repositories';
import { create } from './schemas';
import { ChatBotService } from './service';

type QueryParameters = {
  gptVersion?: GPTVersion;
};

const chatBotPlugin: FastifyPluginAsync = async (fastify) => {
  const chatBotService = new ChatBotService();

  await fastify.register(async function (fastify) {
    fastify.post<{
      Params: { itemId: string };
      Body: Array<ChatBotMessage>;
      Querystring: QueryParameters;
    }>(
      '/:itemId/chat-bot',
      {
        schema: create,
      },
      async ({ authTokenSubject: requestDetails, params: { itemId }, body: prompt, query }) => {
        // default to 3.5 turbo / or the version specified in the env variable
        // as it is the cheapest model while still allowing a larger context window than gpt4
        const gptVersion = query.gptVersion ?? OPENAI_GPT_VERSION;
        const member = requestDetails?.memberId;
        const jwtItemId = requestDetails?.itemId;
        const repositories = buildRepositories();

        await chatBotService.checkJWTItem(jwtItemId, itemId, repositories);

        const message = await chatBotService.post(member, repositories, itemId, prompt, gptVersion);
        return { completion: message.completion, model: message.model };
      },
    );
  });
};

export default chatBotPlugin;
