import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { HttpMethod, MentionStatus } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { AppDataSource } from '../../../plugins/datasource';
import { ITEMS_ROUTE_PREFIX } from '../../../utils/config';
import { saveMember } from '../../member/test/fixtures/members';
import { ChatMentionNotFound, MemberCannotAccessMention } from '../errors';
import { ChatMention } from '../plugins/mentions/chatMention';
import { saveItemWithChatMessages } from './chatMessage.test';

// mock datasource
jest.mock('../../../plugins/datasource');

const adminRepository = AppDataSource.getRepository(ChatMention);

// create item, chat messages from another member and members
// as well as mentions of actor
const saveItemWithChatMessagesAndMentions = async (actor) => {
  const otherActor = await saveMember();
  const { item, chatMessages, members } = await saveItemWithChatMessages(otherActor);
  const chatMentions: ChatMention[] = [];
  for (const c of chatMessages) {
    chatMentions.push(await adminRepository.save({ member: actor, message: c }));
  }
  return { item, chatMessages, members, chatMentions };
};

export const expectChatMentions = (
  mentions,
  correctMentions,
  relations: { member?: boolean; message?: { item?: boolean; creator?: boolean } } = {},
) => {
  const relationsMessageCreator = relations?.message?.creator ?? true;
  const relationsMessageItem = relations?.message?.item ?? true;
  const relationsMessage = (relationsMessageCreator || relationsMessageItem) ?? true;
  const relationsMember = relations?.member ?? true;

  expect(mentions).toHaveLength(correctMentions.length);
  for (const m of mentions) {
    const correctMention = correctMentions.find(({ id }) => id === m.id);

    // foreign keys
    if (relationsMessage) {
      expect(m.message.id).toEqual(correctMention.message.id);

      if (relationsMessageCreator) {
        expect(m.message.creator.id).toEqual(correctMention.message.creator.id);
      } else {
        expect(m.message.creator).toBeUndefined();
      }
      if (relationsMessageItem) {
        expect(m.message.item.id).toEqual(correctMention.message.item.id);
      } else {
        expect(m.message.item).toBeUndefined();
      }
    } else {
      expect(m.message).toBeUndefined();
    }

    if (relationsMember) {
      expect(m.member.id).toEqual(correctMention.member.id);
    } else {
      expect(m.member).toBeUndefined();
    }
  }
};

describe('Chat Mention tests', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('GET /mentions', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/mentions`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    // TODO: public?

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Get successfully', async () => {
        const { chatMentions } = await saveItemWithChatMessagesAndMentions(actor);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/mentions`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check response value
        expectChatMentions(response.json(), chatMentions);
      });
    });
  });

  describe('PATCH /items/mentions/mention-id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const payload = { status: MentionStatus.Read };

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/mentions/${v4()}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let chatMessages, chatMentions;
      const payload = { status: MentionStatus.Read };

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ chatMessages, chatMentions } = await saveItemWithChatMessagesAndMentions(actor));
      });

      it('Patch successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/${chatMentions[0].id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().status).toEqual(payload.status);
      });

      it('Throws if chat mention id is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/invalid`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if body is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/${chatMentions[0].id}`,
          payload: { wrong: 'payload' },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if chat mention does not exist', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/${v4()}`,
          payload,
        });

        expect(response.json()).toMatchObject(new ChatMentionNotFound(expect.anything()));
      });

      it('Throws if member does not have access to mention', async () => {
        // create brand new user because fixtures are used for chatmessages and will already exists
        const member = await saveMember();
        const mention = await adminRepository.save({ member, message: chatMessages[0] });

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/${mention.id}`,
          payload,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccessMention(mention.id));
      });
    });
  });

  describe('DELETE /item-id/chat/message-id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/mentions/${v4()}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let chatMentions, chatMessages, members;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ chatMessages, chatMentions, members } = await saveItemWithChatMessagesAndMentions(
          actor,
        ));
      });

      it('Delete successfully', async () => {
        const initialCount = await adminRepository.count();

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/${chatMentions[0].id}`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(chatMentions[0].body);

        expect(await adminRepository.count()).toEqual(initialCount - 1);
        expect(await adminRepository.findOneBy({ id: chatMentions[0].id })).toBeNull();
      });

      it('Throws if chat mention id is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/invalid-id`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if chat mention does not exist', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/${v4()}`,
        });

        expect(response.json()).toMatchObject(new ChatMentionNotFound(expect.anything()));
      });

      it('Throws if member does not have access to chat message', async () => {
        const mention = await adminRepository.save({
          message: chatMessages[0],
          member: members[0],
        });

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/${mention.id}`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccessMention(expect.anything()));
      });
    });
  });

  describe('DELETE /mentions', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/mentions`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let chatMessages, members;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ chatMessages, members } = await saveItemWithChatMessagesAndMentions(actor));
      });

      it('Delete all successfully', async () => {
        // more messages
        const otherMessages: ChatMention[] = [];
        const message = chatMessages[0];
        otherMessages.push(await adminRepository.save({ message, member: members[0] }));
        otherMessages.push(await adminRepository.save({ message, member: members[1] }));
        otherMessages.push(await adminRepository.save({ message, member: members[2] }));

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/mentions`,
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

        expect(await adminRepository.count()).toEqual(otherMessages.length);
      });
    });
  });
});
