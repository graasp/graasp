import OpenAI from 'openai';

import { PermissionLevel } from '@graasp/sdk';

import { MemberCannotWriteItem } from '../../../../../utils/errors';
import { Repositories } from '../../../../../utils/repositories';
import { validatePermission } from '../../../../authorization';
import { ChatBotMessage } from './interfaces/chat-bot-message';

export class ChatBotService {
  async post(
    actorId: string | undefined,
    repositories: Repositories,
    itemId: string,
    body: Array<ChatBotMessage>,
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

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID,
    });

    const completion = await openai.chat.completions.create({
      messages: body,
      // maybe pass this as an env variable
      model: 'gpt-4',
    });

    const message = completion.choices[0].message.content;
    return message;
  }
}
