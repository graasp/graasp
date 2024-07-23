import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { MentionStatus } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { AppDataSource } from '../../../../plugins/datasource';
import { Actor } from '../../../member/entities/member';
import { ChatMentionNotFound, NoChatMentionForMember } from '../../errors';
import { expectChatMentions } from '../../test/chatMention.test';
import { saveItemWithChatMessages } from '../../test/chatMessage.test';
import { ChatMention } from './chatMention';
import { ChatMentionRepository } from './repository';

// mock datasource
// jest.mock('../../../../plugins/datasource');

const rawRepository = AppDataSource.getRepository(ChatMention);
const repository = new ChatMentionRepository();

const saveItemWithChatMessagesAndMentionsAndNoise = async (actor: Actor) => {
  const { chatMessages, members } = await saveItemWithChatMessages(actor);
  const member = members[0];
  const mention1 = await rawRepository.save({ member, message: chatMessages[0] });
  const mention2 = await rawRepository.save({ member, message: chatMessages[1] });

  // noise
  await rawRepository.save({ member: members[1], message: chatMessages[1] });
  await rawRepository.save({ member: members[2], message: chatMessages[2] });

  return { mentions: [mention1, mention2], member };
};

describe('ChatMentionRepository', () => {
  let app: FastifyInstance;
  let actor;

  beforeEach(async () => {
    ({ app, actor } = await build());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('getForMember', () => {
    it('returns mentions for member', async () => {
      const { mentions, member } = await saveItemWithChatMessagesAndMentionsAndNoise(actor);

      const result = await repository.getForMember(member.id);
      expect(result).toHaveLength(2);
      expectChatMentions(result, mentions);
    });

    it('returns empty if no value', async () => {
      const { chatMessages, members } = await saveItemWithChatMessages(actor);
      const member = members[0];

      // noise
      await rawRepository.save({ member: members[1], message: chatMessages[1] });
      await rawRepository.save({ member: members[2], message: chatMessages[2] });

      const result = await repository.getForMember(member.id);
      expect(result).toHaveLength(0);
    });

    it('throws if member id is undefined', async () => {
      const { chatMessages, members } = await saveItemWithChatMessages(actor);

      // noise
      await rawRepository.save({ member: members[1], message: chatMessages[1] });
      await rawRepository.save({ member: members[2], message: chatMessages[2] });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await expect(repository.getForMember(undefined!)).rejects.toMatchObject(
        new NoChatMentionForMember({ memberId: undefined }),
      );
    });
  });

  describe('get', () => {
    it('returns mention by id', async () => {
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise(actor);
      const mention = mentions[0];
      const result = await repository.get(mention.id);
      // return only member and no message
      expectChatMentions([result], [mention], {
        message: { item: false, creator: false },
        member: true,
      });
    });

    it('throws if id is undefined', async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await expect(repository.get(undefined!)).rejects.toMatchObject(
        new ChatMentionNotFound(undefined),
      );
    });

    it('throws if mention does not exist', async () => {
      const id = v4();
      await expect(repository.get(id)).rejects.toMatchObject(new ChatMentionNotFound(id));
    });
  });

  describe('getMany', () => {
    it('returns many mentions by id', async () => {
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise(actor);

      const result = await repository.getMany(mentions.map(({ id }) => id));
      // return only member and no message
      expectChatMentions(result, mentions, {
        message: { item: false, creator: false },
        member: true,
      });
    });

    it('returns empty if id is empty', async () => {
      await saveItemWithChatMessagesAndMentionsAndNoise(actor);

      const result = await repository.getMany([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('postMany', () => {
    it('save many mentions for message', async () => {
      const { chatMessages, members } = await saveItemWithChatMessages(actor);

      const mIds = members.map((m) => m.id);
      const result = await repository.postMany(mIds, chatMessages[0].id);

      // message is not included
      for (const mention of result) {
        expect(mention.message).toBeUndefined();
      }
      // contains member
      for (const i of mIds) {
        expect(result.map(({ member }) => member.id)).toContain(i);
      }
    });
  });

  describe('patch', () => {
    it('update mention status', async () => {
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise(actor);

      const mention = mentions[0];
      const result = await repository.patch(mention.id, MentionStatus.Read);

      // return only member and no message
      expectChatMentions([result], [mention], {
        message: { item: false, creator: false },
        member: true,
      });
    });
    it('throw if mention does not exist', async () => {
      const id = v4();

      await expect(repository.patch(id, MentionStatus.Read)).rejects.toMatchObject(
        new ChatMentionNotFound(id),
      );
    });
  });

  describe('deleteOne', () => {
    it('delete mention', async () => {
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise(actor);

      const mention = mentions[0];
      const result = await repository.deleteOne(mention.id);

      // return only member and no message
      expectChatMentions([result], [mention], {
        message: { item: false, creator: false },
        member: true,
      });

      await expect(repository.get(mention.id)).rejects.toMatchObject(
        new ChatMentionNotFound(mention.id),
      );
    });
    it('throw if mention does not exist', async () => {
      const id = v4();

      await expect(repository.deleteOne(id)).rejects.toMatchObject(new ChatMentionNotFound(id));
    });
  });

  describe('deleteAll', () => {
    it('delete all mentions for member id', async () => {
      const { member } = await saveItemWithChatMessagesAndMentionsAndNoise(actor);

      await repository.deleteAll(member.id);

      expect(await rawRepository.findBy({ member: { id: member.id } })).toHaveLength(0);
    });
    it('do nothing if user does not exist', async () => {
      await repository.deleteAll(v4());
    });
  });
});
