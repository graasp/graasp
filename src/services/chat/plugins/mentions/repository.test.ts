import { DataSource, Repository } from 'typeorm';
import { v4 } from 'uuid';

import { MemberFactory, MentionStatus } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { Member } from '../../../member/entities/member';
import { ChatMentionNotFound, NoChatMentionForMember } from '../../errors';
import { expectChatMentions } from '../../test/chatMention.test';
import { saveItemWithChatMessages } from '../../test/chatMessage.test';
import { ChatMention } from './chatMention';
import { ChatMentionRepository } from './repository';

const saveItemWithChatMessagesAndMentionsAndNoise = async (
  mentionRawRepository: Repository<ChatMention>,
  actor: Member,
) => {
  const { chatMessages, members } = await saveItemWithChatMessages(actor);
  const member = members[0];
  const mention1 = await mentionRawRepository.save({ account: member, message: chatMessages[0] });
  const mention2 = await mentionRawRepository.save({ account: member, message: chatMessages[1] });

  // noise
  await mentionRawRepository.save({ account: members[1], message: chatMessages[1] });
  await mentionRawRepository.save({ account: members[2], message: chatMessages[2] });

  return { mentions: [mention1, mention2], account: member };
};

describe('ChatMentionRepository', () => {
  let db: DataSource;

  let repository: ChatMentionRepository;
  let memberRawRepository: Repository<Member>;
  let mentionRawRepository: Repository<ChatMention>;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      db = await AppDataSource.initialize();
      await db.runMigrations();
    } else {
      db = AppDataSource;
    }
    repository = new ChatMentionRepository(db.manager);
    mentionRawRepository = db.getRepository(ChatMention);
    memberRawRepository = db.getRepository(Member);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await db.destroy();
  });
  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('getForMember', () => {
    it('returns mentions for member', async () => {
      const actor = await memberRawRepository.save(MemberFactory());
      const { mentions, account } = await saveItemWithChatMessagesAndMentionsAndNoise(
        mentionRawRepository,
        actor,
      );

      const result = await repository.getForAccount(account.id);
      expect(result).toHaveLength(2);
      expectChatMentions(result, mentions);
    });

    it('returns empty if no value', async () => {
      const actor = await memberRawRepository.save(MemberFactory());
      const { chatMessages, members } = await saveItemWithChatMessages(actor);
      const member = members[0];

      // noise
      await mentionRawRepository.save({ account: members[1], message: chatMessages[1] });
      await mentionRawRepository.save({ account: members[2], message: chatMessages[2] });

      const result = await repository.getForAccount(member.id);
      expect(result).toHaveLength(0);
    });

    it('throws if member id is undefined', async () => {
      const actor = await memberRawRepository.save(MemberFactory());
      const { chatMessages, members } = await saveItemWithChatMessages(actor);

      // noise
      await mentionRawRepository.save({ account: members[1], message: chatMessages[1] });
      await mentionRawRepository.save({ account: members[2], message: chatMessages[2] });

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await expect(repository.getForAccount(undefined!)).rejects.toMatchObject(
        new NoChatMentionForMember({ accountId: undefined }),
      );
    });
  });

  describe('get', () => {
    it('returns mention by id', async () => {
      const actor = await memberRawRepository.save(MemberFactory());
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise(
        mentionRawRepository,
        actor,
      );
      const mention = mentions[0];
      const result = await repository.get(mention.id);
      // return only member and no message
      expectChatMentions([result], [mention], {
        message: { item: false, creator: false },
        account: true,
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
      const actor = await memberRawRepository.save(MemberFactory());
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise(
        mentionRawRepository,
        actor,
      );

      const result = await repository.getMany(mentions.map(({ id }) => id));
      // return only member and no message
      expectChatMentions(result, mentions, {
        message: { item: false, creator: false },
        account: true,
      });
    });

    it('returns empty if id is empty', async () => {
      const actor = await memberRawRepository.save(MemberFactory());
      await saveItemWithChatMessagesAndMentionsAndNoise(mentionRawRepository, actor);

      const result = await repository.getMany([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('postMany', () => {
    it('save many mentions for message', async () => {
      const actor = await memberRawRepository.save(MemberFactory());
      const { chatMessages, members } = await saveItemWithChatMessages(actor);

      const mIds = members.map((m) => m.id);
      const result = await repository.postMany(mIds, chatMessages[0].id);

      // message is not included
      for (const mention of result) {
        expect(mention.message).toBeUndefined();
      }
      // contains member
      for (const i of mIds) {
        expect(result.map(({ account: member }) => member.id)).toContain(i);
      }
    });
  });

  describe('patch', () => {
    it('update mention status', async () => {
      const actor = await memberRawRepository.save(MemberFactory());
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise(
        mentionRawRepository,
        actor,
      );

      const mention = mentions[0];
      const result = await repository.patch(mention.id, MentionStatus.Read);

      // return only member and no message
      expectChatMentions([result], [mention], {
        message: { item: false, creator: false },
        account: true,
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
      const actor = await memberRawRepository.save(MemberFactory());
      const { mentions } = await saveItemWithChatMessagesAndMentionsAndNoise(
        mentionRawRepository,
        actor,
      );

      const mention = mentions[0];
      const result = await repository.deleteOne(mention.id);

      // return only member and no message
      expectChatMentions([result], [mention], {
        message: { item: false, creator: false },
        account: true,
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
      const actor = await memberRawRepository.save(MemberFactory());
      const { account } = await saveItemWithChatMessagesAndMentionsAndNoise(
        mentionRawRepository,
        actor,
      );

      await repository.deleteAll(account.id);

      expect(await mentionRawRepository.findBy({ account: { id: account.id } })).toHaveLength(0);
    });
    it('do nothing if user does not exist', async () => {
      await repository.deleteAll(v4());
    });
  });
});
