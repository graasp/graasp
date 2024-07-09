import { FastifyPluginAsync } from 'fastify';

import { ChatBotMessage, GPTVersion } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { notUndefined } from '../../../../../utils/assertions';
import { OPENAI_GPT_VERSION } from '../../../../../utils/config';
import { InvalidJWTItem } from '../../../../../utils/errors';
import { buildRepositories } from '../../../../../utils/repositories';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport';
import { ItemService } from '../../../service';
import { create } from './schemas';
import { ChatBotService } from './service';

type QueryParameters = {
  gptVersion?: GPTVersion;
};

const chatBotPlugin: FastifyPluginAsync = async (fastify) => {
  const itemService = resolveDependency(ItemService);
  const chatBotService = new ChatBotService();

  fastify.register(async function (fastify) {
    fastify.post<{
      Params: { itemId: string };
      Body: Array<ChatBotMessage>;
      Querystring: QueryParameters;
    }>(
      '/:itemId/chat-bot',
      {
        schema: create,
        preHandler: authenticateAppsJWT,
      },
      async ({ user, params: { itemId }, body: prompt, query }, reply) => {
        const member = notUndefined(user?.member);
        const jwtItemId = notUndefined(user?.app).item.id;
        const repositories = buildRepositories();
        if (jwtItemId !== itemId) {
          await itemService.get(member, repositories, itemId);
          throw new InvalidJWTItem(jwtItemId ?? '<EMPTY>', itemId);
        }
        // default to 3.5 turbo / or the version specified in the env variable
        // as it is the cheapest model while still allowing a larger context window than gpt4
        const gptVersion = query.gptVersion ?? OPENAI_GPT_VERSION;

        const message = await chatBotService.post(member, repositories, itemId, prompt, gptVersion);
        reply.code(200).send({ completion: message.completion, model: message.model });
      },
    );
  });
};

export default chatBotPlugin;
