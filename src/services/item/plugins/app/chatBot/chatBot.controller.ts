import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { GPTVersion, GPTVersionType } from '@graasp/sdk';

import { resolveDependency } from '../../../../../di/utils';
import { db } from '../../../../../drizzle/db';
import { asDefined } from '../../../../../utils/assertions';
import { OPENAI_DEFAULT_TEMPERATURE, OPENAI_GPT_VERSION } from '../../../../../utils/config';
import { InvalidJWTItem } from '../../../../../utils/errors';
import { authenticateAppsJWT } from '../../../../auth/plugins/passport';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import { create } from './chatBot.schemas';
import { ChatBotService } from './chatBot.service';

const validateGPTVersion = (gptVersionInput: string | undefined): GPTVersionType => {
  let gptVersion = gptVersionInput;
  // convert removed versions to the default
  if (!gptVersion || !(Object.values(GPTVersion) as string[]).includes(gptVersion)) {
    gptVersion = OPENAI_GPT_VERSION;
  }
  return gptVersion as GPTVersionType;
};

const chatBotPlugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const authorizedItemService = resolveDependency(AuthorizedItemService);
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
        await authorizedItemService.getItemById(db, { accountId: member.id, itemId });
        throw new InvalidJWTItem(jwtItemId ?? '<EMPTY>', itemId);
      }
      // validate the GPTVersion so that we can still support unsupported versions that will default to
      // the standard value
      const gptVersion = validateGPTVersion(query.gptVersion);
      // as it is the cheapest model while still allowing a larger context window than gpt4
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
