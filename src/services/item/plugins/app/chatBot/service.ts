import OpenAI from 'openai';

import { ChatBotMessage, PermissionLevel } from '@graasp/sdk';

import { OPENAI_GPT_VERSION } from '../../../../../utils/config';
import {
  MemberCannotWriteItem,
  OpenAIBaseError,
  OpenAILengthError,
  OpenAIQuotaError,
  OpenAITimeOutError,
} from '../../../../../utils/errors';
import { Repositories } from '../../../../../utils/repositories';
import { validatePermission } from '../../../../authorization';
import { GPTVersion } from './interfaces/gptVersion';

export class ChatBotService {
  async post(
    actorId: string | undefined,
    repositories: Repositories,
    itemId: string,
    body: Array<ChatBotMessage>,
    query?: GPTVersion,
  ) {
    const { memberRepository, itemRepository } = repositories;

    // check member exists
    if (!actorId) {
      throw new MemberCannotWriteItem();
    }
    const member = await memberRepository.get(actorId);

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // check that the member can read the item to be allowed to interact with the chat
    await validatePermission(repositories, PermissionLevel.Read, member, item);

    try {
      const gptVersion = query ?? OPENAI_GPT_VERSION;

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        organization: process.env.OPENAI_ORG_ID,
      });

      const completion = await openai.chat.completions.create({
        messages: body,
        // maybe pass this as an env variable
        model: gptVersion,
      });

      const choice = completion.choices[0];

      switch (choice.finish_reason) {
        case 'length':
          throw new OpenAILengthError();
        case null:
          throw new OpenAITimeOutError();
        case 'stop':
          return { completion: choice.message.content, model: gptVersion };
        default:
          throw new OpenAIBaseError();
      }
    } catch (e) {
      if (e instanceof OpenAIBaseError) {
        throw e;
        // if the catched error is OpenAI insufficient quota
        // throw a new OpenAIQuota error
      } else if (e.status === 429) {
        throw new OpenAIQuotaError();
      }

      // handle unexpected errors (like billing expired)
      throw new OpenAIBaseError({ message: e.message });
    }
  }
}
