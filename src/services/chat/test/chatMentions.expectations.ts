import { expect } from 'vitest';

import type { ChatMentionRaw, ChatMentionWithMessageAndCreator } from '../../../drizzle/types';

export const expectFullChatMentions = (
  mentions: ChatMentionWithMessageAndCreator[],
  correctMentions: ChatMentionRaw[],
) => {
  expect(mentions).toHaveLength(correctMentions.length);
  for (const m of mentions) {
    const correctMention = correctMentions.find(({ id }) => id === m.id)!;

    expect(m.message.id).toEqual(correctMention.messageId);
    expect(m.message.creatorId).toBeDefined();
    expect(m.account.id).toEqual(correctMention.accountId);
  }
};

export const expectRawChatMentions = (
  mentions: ChatMentionRaw[],
  correctMentions: ChatMentionRaw[],
) => {
  expect(mentions).toHaveLength(correctMentions.length);
  for (const m of mentions) {
    const correctMention = correctMentions.find(({ id }) => id === m.id)!;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { updatedAt, ...c } = correctMention;
    expect(m).toMatchObject(c);
  }
};
