import { eq } from 'drizzle-orm/sql';
import { v4 } from 'uuid';
import { describe, expect, it } from 'vitest';

import { MentionStatus } from '@graasp/sdk';

import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { chatMentionsTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { ChatMentionNotFound, NoChatMentionForMember } from '../../errors';
import {
  expectFullChatMentions,
  expectRawChatMentions,
} from '../../test/chatMentions.expectations';
import { ChatMentionRepository } from './chatMention.repository';

const repository = new ChatMentionRepository();

const saveItemWithChatMessagesAndMentionsAndNoise = async () => {
  const { actor, members, chatMessages } = await seedFromJson({
    items: [{ chatMessages: [{ creator: 'actor' }, { creator: 'actor' }, { creator: 'actor' }] }],
    members: [{}, {}],
  });
  const member = members[0];
  assertIsDefined(member);
  assertIsDefined(actor);
  assertIsDefined(member);

  const mentions = await db
    .insert(chatMentionsTable)
    .values([
      {
        accountId: actor.id,
        messageId: chatMessages[0].id,
      },
      {
        accountId: actor.id,
        messageId: chatMessages[1].id,
      },
      // noise
      {
        accountId: members[0].id,
        messageId: chatMessages[1].id,
      },
      {
        accountId: members[1].id,
        messageId: chatMessages[2].id,
      },
    ])
    .returning();

  return { mentions: mentions.slice(0, 2), actor };
};

describe('ChatMentionRepository', () => {
  describe('getForMember', () => {
    it('returns mentions for member', async () => {
      const { mentions, actor } = await saveItemWithChatMessagesAndMentionsAndNoise();

      const result = await repository.getForAccount(db, actor.id);
      expect(result).toHaveLength(2);
      expectFullChatMentions(result, mentions);
    });

    it('returns empty if no value', async () => {
      const { actor, members, chatMessages } = await seedFromJson({
        items: [
          { chatMessages: [{ creator: 'actor' }, { creator: 'actor' }, { creator: 'actor' }] },
        ],
        members: [{}, {}],
      });
      assertIsDefined(actor);
      await db.insert(chatMentionsTable).values([
        // noise
        {
          accountId: members[0].id,
          messageId: chatMessages[1].id,
        },
        {
          accountId: members[1].id,
          messageId: chatMessages[2].id,
        },
      ]);

      const result = await repository.getForAccount(db, actor.id);
      expect(result).toHaveLength(0);
    });

    it('throws if member id is undefined', async () => {
      const { members, chatMessages } = await seedFromJson({
        items: [
          { chatMessages: [{ creator: 'actor' }, { creator: 'actor' }, { creator: 'actor' }] },
        ],
        members: [{}, {}],
      });

      await db.insert(chatMentionsTable).values([
        // noise
        {
          accountId: members[0].id,
          messageId: chatMessages[1].id,
        },
        {
          accountId: members[1].id,
          messageId: chatMessages[2].id,
        },
      ]);

      await expect(
        async () =>
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await repository.getForAccount(db, undefined!),
      ).rejects.toThrow(new NoChatMentionForMember({ accountId: undefined }));
    });
  });

  describe('get', () => {
    it('returns mention by id', async () => {
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise();
      const mention = mentions[0];
      const result = await repository.get(db, mention.id);
      expectRawChatMentions([result], [mention]);
    });

    it('throws if id is undefined', async () => {
      await expect(
        async () =>
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          await repository.get(db, undefined!),
      ).rejects.toThrow(new ChatMentionNotFound(undefined));
    });

    it('throws if mention does not exist', async () => {
      const id = v4();
      await expect(async () => await repository.get(db, id)).rejects.toThrow(
        new ChatMentionNotFound(id),
      );
    });
  });

  describe('postMany', () => {
    it('save many mentions for message', async () => {
      const { members, chatMessages } = await seedFromJson({
        items: [
          { chatMessages: [{ creator: 'actor' }, { creator: 'actor' }, { creator: 'actor' }] },
        ],
        members: [{}, {}],
      });

      const mIds = members.map((m) => m.id);
      const result = await repository.postMany(db, mIds, chatMessages[0].id);
      for (const i of mIds) {
        expect(result.map(({ accountId }) => accountId)).toContain(i);
      }
    });
  });

  describe('patch', () => {
    it('update mention status', async () => {
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise();

      const mention = mentions[0];
      const result = await repository.patch(db, mention.id, MentionStatus.Read);

      // return only member and no message
      expectRawChatMentions([result], [{ ...mention, status: MentionStatus.Read }]);
    });
    it('throw if mention does not exist', async () => {
      const id = v4();

      await expect(async () => await repository.patch(db, id, MentionStatus.Read)).rejects.toThrow(
        new ChatMentionNotFound(id),
      );
    });
  });

  describe('deleteOne', () => {
    it('delete mention', async () => {
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise();

      const mention = mentions[0];
      const result = await repository.deleteOne(db, mention.id);

      // return only member and no message
      expectRawChatMentions([result], [mention]);

      await expect(async () => await repository.get(db, mention.id)).rejects.toThrow(
        new ChatMentionNotFound(mention.id),
      );
    });
    it('throw if mention does not exist', async () => {
      const id = v4();

      await expect(async () => await repository.deleteOne(db, id)).rejects.toThrow(
        new ChatMentionNotFound(id),
      );
    });
  });

  describe('deleteAll', () => {
    it('delete all mentions for member id', async () => {
      const { actor } = await saveItemWithChatMessagesAndMentionsAndNoise();

      await repository.deleteAll(db, actor.id);
      expect(
        await db.query.chatMentionsTable.findMany({
          where: eq(chatMentionsTable.accountId, actor.id),
        }),
      ).toHaveLength(0);
    });
    it('do nothing if user does not exist', async () => {
      await repository.deleteAll(db, v4());
    });
  });
});
