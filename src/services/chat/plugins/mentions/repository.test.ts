import { eq } from 'drizzle-orm/sql';
import { v4 } from 'uuid';

import { MentionStatus } from '@graasp/sdk';

import { seedFromJson } from '../../../../../test/mocks/seed';
import { client, db } from '../../../../drizzle/db';
import { chatMentionsTable } from '../../../../drizzle/schema';
import { ChatMentionNotFound, NoChatMentionForMember } from '../../errors';
import { expectChatMentions } from '../../test/chatMention.test';
import { saveItemWithChatMessages } from '../../test/chatMessage.test';
import { ChatMentionRepository } from './repository';

const repository = new ChatMentionRepository();

const saveItemWithChatMessagesAndMentionsAndNoise = async (actor: Member) => {
  seedFromJson({});
  const { chatMessages, members } = await saveItemWithChatMessages(actor);
  const member = members[0];
  const mention1 = await rawRepository.save({
    account: member,
    message: chatMessages[0],
  });
  const mention2 = await rawRepository.save({
    account: member,
    message: chatMessages[1],
  });

  // noise
  await rawRepository.save({ account: members[1], message: chatMessages[1] });
  await rawRepository.save({ account: members[2], message: chatMessages[2] });

  return { mentions: [mention1, mention2], account: member };
};

describe('ChatMentionRepository', () => {
  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  describe('getForMember', () => {
    it('returns mentions for member', async () => {
      const { mentions, account } = await saveItemWithChatMessagesAndMentionsAndNoise(actor);

      const result = await repository.getForAccount(db, account.id);
      expect(result).toHaveLength(2);
      expectChatMentions(result, mentions);
    });

    it('returns empty if no value', async () => {
      const { chatMessages, members } = await saveItemWithChatMessages(actor);
      const member = members[0];

      // noise
      await rawRepository.save({
        account: members[1],
        message: chatMessages[1],
      });
      await rawRepository.save({
        account: members[2],
        message: chatMessages[2],
      });

      const result = await repository.getForAccount(db, member.id);
      expect(result).toHaveLength(0);
    });

    it('throws if member id is undefined', async () => {
      const { chatMessages, members } = await saveItemWithChatMessages(actor);

      // noise
      await rawRepository.save({
        account: members[1],
        message: chatMessages[1],
      });
      await rawRepository.save({
        account: members[2],
        message: chatMessages[2],
      });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await expect(repository.getForAccount(db, undefined!)).rejects.toMatchObject(
        new NoChatMentionForMember({ accountId: undefined }),
      );
    });
  });

  describe('get', () => {
    it('returns mention by id', async () => {
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise(actor);
      const mention = mentions[0];
      const result = await repository.get(db, mention.id);
      // return only member and no message
      expectChatMentions([result], [mention], {
        message: { item: false, creator: false },
        account: true,
      });
    });

    it('throws if id is undefined', async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await expect(repository.get(db, undefined!)).rejects.toMatchObject(
        new ChatMentionNotFound(undefined),
      );
    });

    it('throws if mention does not exist', async () => {
      const id = v4();
      await expect(repository.get(db, id)).rejects.toMatchObject(new ChatMentionNotFound(id));
    });
  });

  describe('getMany', () => {
    it('returns many mentions by id', async () => {
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise(actor);

      const result = await repository.getMany(
        db,
        mentions.map(({ id }) => id),
      );
      // return only member and no message
      expectChatMentions(result, mentions, {
        message: { item: false, creator: false },
        account: true,
      });
    });

    it('returns empty if id is empty', async () => {
      await saveItemWithChatMessagesAndMentionsAndNoise(actor);

      const result = await repository.getMany(db, []);
      expect(result).toHaveLength(0);
    });
  });

  describe('postMany', () => {
    it('save many mentions for message', async () => {
      const { chatMessages, members } = await saveItemWithChatMessages(actor);

      const mIds = members.map((m) => m.id);
      const result = await repository.postMany(db, mIds, chatMessages[0].id);
      for (const i of mIds) {
        expect(result.map(({ accountId }) => accountId)).toContain(i);
      }
    });
  });

  describe('patch', () => {
    it('update mention status', async () => {
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise(actor);

      const mention = mentions[0];
      const result = await repository.patch(db, mention.id, MentionStatus.Read);

      // return only member and no message
      expectChatMentions([result], [mention], {
        message: { item: false, creator: false },
        account: true,
      });
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
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise(actor);

      const mention = mentions[0];
      const result = await repository.deleteOne(db, mention.id);

      // return only member and no message
      expectChatMentions([result], [mention], {
        message: { item: false, creator: false },
        account: true,
      });

      await expect(async () => await repository.get(db, mention.id)).rejects.toThrow(
        new ChatMentionNotFound(mention.id),
      );
    });
    it('throw if mention does not exist', async () => {
      const id = v4();

      await expect(repository.deleteOne(db, id)).rejects.toMatchObject(new ChatMentionNotFound(id));
    });
  });

  describe('deleteAll', () => {
    it('delete all mentions for member id', async () => {
      const { account } = await saveItemWithChatMessagesAndMentionsAndNoise(actor);

      await repository.deleteAll(db, account.id);

      expect(
        await db.query.chatMentionsTable.findMany({
          where: eq(chatMentionsTable.accountId, account.id),
        }),
      ).toHaveLength(0);
    });
    it('do nothing if user does not exist', async () => {
      await repository.deleteAll(db, v4());
    });
  });
});
