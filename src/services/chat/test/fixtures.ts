import { faker } from '@faker-js/faker';
import { v4 } from 'uuid';

import type { ChatMentionRaw, ChatMessageRaw } from '../../../drizzle/types';
import type { MinimalMember } from '../../../types';

export const ChatMessageWithMentionFactory = ({
  creator,
  // item,
  mentionMember,
}: {
  creator: MinimalMember;
  // item: Item;
  mentionMember: MinimalMember;
}): { chatMessage: ChatMessageRaw; chatMention: ChatMentionRaw } => {
  // mock the mention format of react-mention used in the chat-box
  const mentionMessage = `<!@${mentionMember.id}>[${mentionMember.name}]`;

  const body = `${mentionMessage} some-text-${faker.word.sample()} <!@${creator.id}>[${creator.name}]`;
  const chatMessage = {
    id: v4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    itemId: v4(),
    creatorId: creator.id,
    body,
  };
  const chatMention = {
    accountId: mentionMember.id,
    messageId: chatMessage.id,
    id: v4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'read' as const,
  };
  return { chatMessage, chatMention };
};
