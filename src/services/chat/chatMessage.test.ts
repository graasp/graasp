import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { HttpMethod, ItemType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../test/app';
import { ITEMS_ROUTE_PREFIX } from '../../util/config';
import { ItemNotFound, MemberCannotAccess } from '../../util/graasp-error';
import { getDummyItem } from '../item/test/fixtures/items';
import { saveItemAndMembership } from '../itemMembership/test/fixtures/memberships';
import { Member } from '../member/entities/member';
import MemberRepository from '../member/repository';
import { MEMBERS, saveMember } from '../member/test/fixtures/members';
import { ChatMessage } from './chatMessage';
import { ChatMessageNotFound, MemberCannotDeleteMessage, MemberCannotEditMessage } from './errors';
import { ChatMentionRepository } from './plugins/mentions/repository';
import { ChatMessageRepository } from './repository';

// mock datasource
jest.mock('../../plugins/datasource');

export const saveItemWithChatMessages = async (creator) => {
  const { item } = await saveItemAndMembership({ member: creator });
  const chatMessages: ChatMessage[] = [];
  const members: Member[] = [];
  for (let i = 0; i < MEMBERS.length; i++) {
    const member = await saveMember(MEMBERS[i]);
    members.push(member);
    chatMessages.push(
      await ChatMessageRepository.save({ item, member, creator, body: 'some-text-' + i }),
    );
  }
  return { item, chatMessages, members };
};

const expectChatMessages = (messages, correctMessages) => {
  expect(messages).toHaveLength(correctMessages.length);
  for (const message of messages) {
    const correctMessage = correctMessages.find(({ id }) => id === message.id);
    expect(message.creator.id).toEqual(correctMessage.creator.id);
    expect(message.body).toEqual(correctMessage.body);
  }
};

describe('Chat Message tests', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('GET /item-id/chat', () => {
    it('Throws for private item', async () => {
      ({ app } = await build({ member: null }));

      const item = getDummyItem({ type: ItemType.FOLDER });

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    // TODO: public?

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Get successfully', async () => {
        const { item, chatMessages } = await saveItemWithChatMessages(actor);

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check response value
        expectChatMessages(response.json(), chatMessages);

        // TODO: check schema of return values
      });

      it('Throws if item id is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/chat`,
        });

        expect(response.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });

      it('Throws if member does not have access to item', async () => {
        // create brand new user because fixtures are used for chatmessages and will already exists
        const member = await saveMember({
          name: 'new-user',
          email: 'new@email.org',
        });
        const { item } = await saveItemWithChatMessages(member);

        const response = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });
  });

  describe('POST /item-id/chat', () => {
    it('Throws for private item', async () => {
      ({ app } = await build({ member: null }));

      const item = getDummyItem({ type: ItemType.FOLDER });
      const payload = { body: 'hello' };

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    // TODO: public?

    describe('Signed In', () => {
      let item;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await saveItemWithChatMessages(actor));
      });

      it('Post successfully', async () => {
        const payload = { body: 'hello' };
        const initialCount = (await ChatMessageRepository.find()).length;

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(payload.body);

        expect(await ChatMessageRepository.find()).toHaveLength(initialCount + 1);
      });

      it('Post successfully with mentions', async () => {
        const mock = jest.spyOn(app.mailer, 'sendEmail');

        const members = await MemberRepository.find();
        const payload = { body: 'hello', mentions: members.map(({ id }) => id) };
        const initialCount = (await ChatMessageRepository.find()).length;

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(payload.body);

        expect(await ChatMessageRepository.find()).toHaveLength(initialCount + 1);

        // check mentions and send email
        const mentions = await ChatMentionRepository.find();
        expect(mentions).toHaveLength(members.length);

        expect(mock).toHaveBeenCalledTimes(members.length);
      });

      it('Throws if item id is incorrect', async () => {
        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/chat`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if body is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
          payload: { wrong: 'schema' },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/chat`,
          payload,
        });

        expect(response.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });

      it('Throws if member does not have access to item', async () => {
        const payload = { body: 'hello' };
        // create brand new user because fixtures are used for chatmessages and will already exists
        const member = await saveMember({
          name: 'new-user',
          email: 'new@email.org',
        });
        const { item: otherItem } = await saveItemAndMembership({ member });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: `${ITEMS_ROUTE_PREFIX}/${otherItem.id}/chat`,
          payload,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });
  });

  describe('PATCH /item-id/chat/message-id', () => {
    it('Throws for private item', async () => {
      ({ app } = await build({ member: null }));

      const item = getDummyItem({ type: ItemType.FOLDER });
      const payload = { body: 'hello' };

      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${v4()}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let item, chatMessages, members;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, chatMessages, members } = await saveItemWithChatMessages(actor));
      });

      it('Patch successfully', async () => {
        const payload = { body: 'hello' };
        const chatMessage = await ChatMessageRepository.save({
          item,
          creator: actor,
          body: 'body',
        });
        const initialCount = (await ChatMessageRepository.find()).length;

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(payload.body);

        expect(await ChatMessageRepository.find()).toHaveLength(initialCount);
      });

      it('Throws if item id is incorrect', async () => {
        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/chat/${chatMessages[0].id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if chat message id is incorrect', async () => {
        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/invalid-id`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if body is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessages[0].id}`,
          payload: { wrong: 'payload' },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/chat/${chatMessages[0].id}`,
          payload,
        });

        expect(response.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });

      it('Throws if chat message does not exist', async () => {
        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${v4()}`,
          payload,
        });

        expect(response.json()).toMatchObject(new ChatMessageNotFound(expect.anything()));
      });

      it('Throws if member does not have access to item', async () => {
        const payload = { body: 'hello' };
        // create brand new user because fixtures are used for chatmessages and will already exists
        const member = await saveMember({
          name: 'new-user',
          email: 'new@email.org',
        });
        const { item: otherItem } = await saveItemAndMembership({ member });

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `${ITEMS_ROUTE_PREFIX}/${otherItem.id}/chat/${chatMessages[0].id}`,
          payload,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });

      it('Throws if member does not have access to chat message', async () => {
        const payload = { body: 'hello' };
        const chatMessage = await ChatMessageRepository.save({
          item,
          creator: members[0],
          body: 'body',
        });

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
          payload,
        });

        expect(response.json()).toMatchObject(new MemberCannotEditMessage(expect.anything()));
      });
    });
  });

  describe('DELETE /item-id/chat/message-id', () => {
    it('Throws for private item', async () => {
      ({ app } = await build({ member: null }));

      const item = getDummyItem({ type: ItemType.FOLDER });

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${v4()}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let item, chatMessages, members;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, chatMessages, members } = await saveItemWithChatMessages(actor));
      });

      it('Delete successfully', async () => {
        const chatMessage = await ChatMessageRepository.save({
          item,
          creator: actor,
          body: 'body',
        });
        const initialCount = (await ChatMessageRepository.find()).length;

        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(chatMessage.body);

        expect(await ChatMessageRepository.find()).toHaveLength(initialCount - 1);
        expect(await ChatMessageRepository.get(chatMessage.id)).toBeNull();
      });

      it('Throws if item id is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/chat/${v4()}`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if chat message id is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/invalid-id`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/chat/${v4()}`,
        });

        expect(response.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });

      it('Throws if chat message does not exist', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${v4()}`,
        });

        expect(response.json()).toMatchObject(new ChatMessageNotFound(expect.anything()));
      });

      it('Throws if member does not have access to item', async () => {
        // create brand new user because fixtures are used for chatmessages and will already exists
        const member = await saveMember({
          name: 'new-user',
          email: 'new@email.org',
        });
        const { item: otherItem } = await saveItemAndMembership({ member });

        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${otherItem.id}/chat/${v4()}`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });

      it('Throws if member does not have access to chat message', async () => {
        const chatMessage = await ChatMessageRepository.save({
          item,
          creator: members[0],
          body: 'body',
        });

        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
        });

        expect(response.json()).toMatchObject(new MemberCannotDeleteMessage(expect.anything()));
      });
    });
  });

  describe('DELETE /item-id/chat', () => {
    it('Throws for private item', async () => {
      ({ app } = await build({ member: null }));

      const item = getDummyItem({ type: ItemType.FOLDER });

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let item;

      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await saveItemWithChatMessages(actor));
      });

      it('Delete all successfully', async () => {
        // more messages
        const { item: anotherItem } = await saveItemAndMembership({ member: actor });
        const otherMessages: ChatMessage[] = [];
        otherMessages.push(
          await ChatMessageRepository.save({ item: anotherItem, creator: actor, body: 'dd' }),
        );
        otherMessages.push(
          await ChatMessageRepository.save({ item: anotherItem, creator: actor, body: 'dd' }),
        );
        otherMessages.push(
          await ChatMessageRepository.save({ item: anotherItem, creator: actor, body: 'dd' }),
        );

        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        expect(await ChatMessageRepository.find()).toHaveLength(otherMessages.length);
      });

      it('Throws if item id is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/chat`,
        });

        expect(response.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });

      it('Throws if member does not have access to item', async () => {
        // create brand new user because fixtures are used for chatmessages and will already exists
        const member = await saveMember({
          name: 'new-user',
          email: 'new@email.org',
        });
        const { item: otherItem } = await saveItemAndMembership({ member });

        const response = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${otherItem.id}/chat`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });
  });
});
