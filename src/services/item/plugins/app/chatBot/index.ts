import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../di/utils';
import { asDefined } from '../../../../../utils/assertions';
import { OPENAI_DEFAULT_TEMPERATURE, OPENAI_GPT_VERSION } from '../../../../../utils/config';
import { InvalidJWTItem } from '../../../../../utils/errors';
import { buildRepositories } from '../../../../../utils/repositories';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport';
import { ItemService } from '../../../service';
import { create } from './schemas';
import { ChatBotService } from './service';

const chatBotPlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemService = resolveDependency(ItemService);
  const chatBotService = new ChatBotService();

  fastify.post(
    '/:itemId/chat-bot',
    {
      schema: create,
      preHandler: authenticateAppsJWT,
    },
    async ({ user, params: { itemId }, body: prompt, query }, reply) => {
      const member = asDefined(user?.account);
      const jwtItemId = asDefined(user?.app).item.id;
      const repositories = buildRepositories();
      if (jwtItemId !== itemId) {
        await itemService.get(member, repositories, itemId);
        throw new InvalidJWTItem(jwtItemId ?? '<EMPTY>', itemId);
      }
      // default to 3.5 turbo / or the version specified in the env variable
      // as it is the cheapest model while still allowing a larger context window than gpt4
      const gptVersion = query.gptVersion ?? OPENAI_GPT_VERSION;
      const temperature = query.temperature ?? OPENAI_DEFAULT_TEMPERATURE;

      const message = await chatBotService.post(
        member,
        repositories,
        itemId,
        prompt,
        gptVersion,
        temperature,
      );
      reply.code(200).send({ completion: message.completion, model: message.model });
    },
  );
};

export default chatBotPlugin;
