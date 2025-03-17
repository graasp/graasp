import { ChatMentionRaw, ChatMentionWithMessageAndCreator } from '../../../drizzle/types';

export const expectChatMentions = (
  mentions: ChatMentionWithMessageAndCreator[],
  correctMentions: ChatMentionRaw[],
  relations: { account?: boolean; message?: boolean } = {},
) => {
  const relationsMessage = relations?.message ?? true;
  const relationsMember = relations?.account ?? true;

  expect(mentions).toHaveLength(correctMentions.length);
  for (const m of mentions) {
    const correctMention = correctMentions.find(({ id }) => id === m.id)!;

    // foreign keys
    if (relationsMessage) {
      expect(m.message.id).toEqual(correctMention.messageId);
      expect(m.message.creatorId).toBeUndefined();
    } else {
      expect(m.message).toBeUndefined();
    }

    if (relationsMember) {
      expect(m.account.id).toEqual(correctMention.accountId);
    } else {
      expect(m.account).toBeUndefined();
    }
  }
};
