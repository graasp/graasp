import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { FolderItemFactory, HttpMethod } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
import { seedFromJson } from '../../../test/mocks/seed';
import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import { MailerService } from '../../plugins/mailer/mailer.service';
import { assertIsDefined } from '../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../utils/config';
import { ItemNotFound, MemberCannotAccess } from '../../utils/errors';
import { saveMember } from '../member/test/fixtures/members';
import { ChatMessageNotFound, MemberCannotDeleteMessage, MemberCannotEditMessage } from './errors';
import { ChatMessageRepository } from './repository';

const expectChatMessages = (messages, correctMessages) => {
  expect(messages).toHaveLength(correctMessages.length);
  for (const message of messages) {
    const correctMessage = correctMessages.find(({ id }) => id === message.id);
    expect(message.creator.id).toEqual(correctMessage.creator.id);
    expect(message.body).toEqual(correctMessage.body);
  }
};

describe('Chat Message tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('GET /item-id/chat', () => {
    it('Throws for private item', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    describe('Signed In', () => {
      it('Get successfully', async () => {
        const {
          items: [item],
          chatMessages,
          actor,
        } = await seedFromJson({
          items: [
            {
              chatMessages: [
                { creator: { name: 'bob' } },
                { creator: 'actor' },
                { creator: { name: 'alice' } },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check response value
        expectChatMessages(response.json(), chatMessages);

        // TODO: check schema of return values
      });

      it('Throws if item id is incorrect', async () => {
        const { actor } = await seedFromJson({});
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const { actor } = await seedFromJson({});
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/chat`,
        });

        expect(response.json()).toMatchObject({ code: 'GERR001', message: ``, statusCode: 404 });
      });

      it('Throws if member does not have access to item', async () => {
        // create brand new user because fixtures are used for chatmessages and will already exists
        const {
          items: [item],
          actor,
          members: [member],
        } = await seedFromJson({
          items: [{}],
          members: [{}],
        });
        assertIsDefined(actor);
        mockAuthenticate(member);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });

    describe('Public', () => {
      it('Get successfully', async () => {
        const member = await saveMember();
        const { item, chatMessages } = await saveItemWithChatMessages(member);
        await setItemPublic(item, member);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check response value
        expectChatMessages(response.json(), chatMessages);

        // TODO: check schema of return values
      });
    });
  });

  describe('POST /item-id/chat', () => {
    it('Throws for private item', async () => {
      const item = FolderItemFactory();
      const payload = { body: 'hello' };

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let item;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
        ({ item } = await saveItemWithChatMessages(actor));
      });

      it('Post successfully', async () => {
        const payload = { body: 'hello' };
        const initialCount = await rawChatMessageRepository.count();

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(payload.body);

        expect(await rawChatMessageRepository.count()).toEqual(initialCount + 1);
      });

      it('Post successfully with mentions', async () => {
        const mailerService = resolveDependency(MailerService);
        const mock = jest.spyOn(mailerService, 'sendRaw');

        const members = await memberRawRepository.find();
        const payload = {
          body: 'hello',
          mentions: members.map(({ id }) => id),
        };
        const initialCount = await rawChatMessageRepository.count();

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(payload.body);

        expect(await rawChatMessageRepository.count()).toEqual(initialCount + 1);

        // check mentions and send email
        const nbMentions = await adminChatMentionRepository.count();
        expect(nbMentions).toEqual(members.length);

        expect(mock).toHaveBeenCalledTimes(members.length);
      });

      it('Throws if item id is incorrect', async () => {
        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/chat`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if body is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
          payload: { wrong: 'schema' },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/chat`,
          payload,
        });

        expect(response.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });

      it('Throws if member does not have access to item', async () => {
        const payload = { body: 'hello' };
        // create brand new user because fixtures are used for chatmessages and will already exists
        const member = await saveMember();
        const { item: otherItem } = await testUtils.saveItemAndMembership({
          member,
        });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${otherItem.id}/chat`,
          payload,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });
  });

  describe('PATCH /item-id/chat/message-id', () => {
    it('Throws for private item', async () => {
      const item = FolderItemFactory();
      const payload = { body: 'hello' };

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${v4()}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let item, chatMessages, members;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
        ({ item, chatMessages, members } = await saveItemWithChatMessages(actor));
      });

      it('Patch successfully', async () => {
        const payload = { body: 'hello' };
        const chatMessage = await rawChatMessageRepository.save({
          item,
          creator: actor,
          body: 'body',
        });

        const initialCount = await rawChatMessageRepository.count();

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(payload.body);

        expect(await rawChatMessageRepository.count()).toEqual(initialCount);
      });

      it('Throws if item id is incorrect', async () => {
        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/chat/${chatMessages[0].id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if chat message id is incorrect', async () => {
        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/invalid-id`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if body is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessages[0].id}`,
          payload: { wrong: 'payload' },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/chat/${chatMessages[0].id}`,
          payload,
        });

        expect(response.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });

      it('Throws if chat message does not exist', async () => {
        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${v4()}`,
          payload,
        });

        expect(response.json()).toMatchObject(new ChatMessageNotFound(expect.anything()));
      });

      it('Throws if member does not have access to item', async () => {
        const payload = { body: 'hello' };
        // create brand new user because fixtures are used for chatmessages and will already exists
        const member = await saveMember();
        const { item: otherItem } = await testUtils.saveItemAndMembership({
          member,
        });

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${otherItem.id}/chat/${chatMessages[0].id}`,
          payload,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });

      it('Throws if member does not have access to chat message', async () => {
        const payload = { body: 'hello' };
        const chatMessage = await rawChatMessageRepository.save({
          item,
          creator: members[0],
          body: 'body',
        });

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
          payload,
        });
        const res = await response.json();
        expect(res).toMatchObject(new MemberCannotEditMessage(expect.anything()));
      });
    });
  });

  describe('DELETE /item-id/chat/message-id', () => {
    it('Throws for private item', async () => {
      const item = FolderItemFactory();

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${v4()}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let item, members;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
        ({ item, members } = await saveItemWithChatMessages(actor));
      });

      it('Delete successfully', async () => {
        const chatMessage = await rawChatMessageRepository.save({
          item,
          creator: actor,
          body: 'body',
        });
        const initialCount = await rawChatMessageRepository.count();

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(chatMessage.body);

        expect(await rawChatMessageRepository.count()).toEqual(initialCount - 1);
        expect(await new ChatMessageRepository().getOne(chatMessage.id)).toBeNull();
      });

      it('Throws if item id is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/chat/${v4()}`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if chat message id is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/invalid-id`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/chat/${v4()}`,
        });

        expect(response.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });

      it('Throws if chat message does not exist', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${v4()}`,
        });

        expect(response.json()).toMatchObject(new ChatMessageNotFound(expect.anything()));
      });

      it('Throws if member does not have access to item', async () => {
        // create brand new user because fixtures are used for chatmessages and will already exists
        const member = await saveMember();
        const { item: otherItem } = await testUtils.saveItemAndMembership({
          member,
        });

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${otherItem.id}/chat/${v4()}`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });

      it('Throws if member does not have access to chat message', async () => {
        const chatMessage = await rawChatMessageRepository.save({
          item,
          creator: members[0],
          body: 'body',
        });

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
        });
        const res = await response.json();
        expect(res).toMatchObject(new MemberCannotDeleteMessage({ id: expect.anything() }));
      });
    });
  });

  describe('DELETE /item-id/chat', () => {
    it('Throws for private item', async () => {
      const item = FolderItemFactory();

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let item;

      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
        ({ item } = await saveItemWithChatMessages(actor));
      });

      it('Delete all successfully', async () => {
        // more messages
        const { item: anotherItem } = await testUtils.saveItemAndMembership({
          member: actor,
        });
        const otherMessages: ChatMessage[] = [];
        otherMessages.push(
          await rawChatMessageRepository.save({
            item: anotherItem,
            creator: actor,
            body: 'dd',
          }),
        );
        otherMessages.push(
          await rawChatMessageRepository.save({
            item: anotherItem,
            creator: actor,
            body: 'dd',
          }),
        );
        otherMessages.push(
          await rawChatMessageRepository.save({
            item: anotherItem,
            creator: actor,
            body: 'dd',
          }),
        );

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        expect(await rawChatMessageRepository.countBy({ item })).toEqual(0);
        expect(await rawChatMessageRepository.countBy({ item: anotherItem })).toEqual(
          otherMessages.length,
        );
      });

      it('Throws if item id is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/chat`,
        });

        expect(response.json()).toMatchObject(new ItemNotFound(expect.anything()));
      });

      it('Throws if member does not have access to item', async () => {
        // create brand new user because fixtures are used for chatmessages and will already exists
        const member = await saveMember();
        const { item: otherItem } = await testUtils.saveItemAndMembership({
          member,
        });

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${otherItem.id}/chat`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });
  });
});
