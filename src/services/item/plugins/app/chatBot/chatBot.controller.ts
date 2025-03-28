import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { asDefined } from '../../../../../utils/assertions';
import { OPENAI_DEFAULT_TEMPERATURE, OPENAI_GPT_VERSION } from '../../../../../utils/config';
import { InvalidJWTItem } from '../../../../../utils/errors';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport';
import { ItemService } from '../../../item.service';
import { create } from './chatBot.schemas';
import { ChatBotService } from './chatBot.service';

const chatBotPlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const itemService = resolveDependency(ItemService);
  const chatBotService = resolveDependency(ChatBotService);

  fastify.post(
    '/:itemId/chat-bot',
    {
      schema: create,
      preHandler: authenticateAppsJWT,
    },
    async ({ user, params: { itemId }, body: prompt, query }, reply) => {
      const member = asDefined(user?.account);
      const jwtItemId = asDefined(user?.app).item.id;
      if (jwtItemId !== itemId) {
        await itemService.basicItemService.get(db, member, itemId);
        throw new InvalidJWTItem(jwtItemId ?? '<EMPTY>', itemId);
      }
      // default to 3.5 turbo / or the version specified in the env variable
      // as it is the cheapest model while still allowing a larger context window than gpt4
      const gptVersion = query.gptVersion ?? OPENAI_GPT_VERSION;
      const temperature = query.temperature ?? OPENAI_DEFAULT_TEMPERATURE;

      const message = await chatBotService.post(
        db,
        member,
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
