import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
import { seedFromJson } from '../../../test/mocks/seed';
import { resolveDependency } from '../../di/utils';
import { db } from '../../drizzle/db';
import { chatMentionsTable, chatMessagesTable } from '../../drizzle/schema';
import type { ChatMessageRaw } from '../../drizzle/types';
import { MailerService } from '../../plugins/mailer/mailer.service';
import { assertIsDefined } from '../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../utils/config';
import { ItemNotFound, MemberCannotAccess } from '../../utils/errors';
import { ChatMessageNotFound, MemberCannotDeleteMessage, MemberCannotEditMessage } from './errors';

const getMessagesByItemId = async (itemId: string) =>
  await db.query.chatMessagesTable.findMany({
    where: eq(chatMessagesTable.itemId, itemId),
  });

const expectChatMessages = (messages, correctMessages: ChatMessageRaw[]) => {
  expect(messages).toHaveLength(correctMessages.length);
  for (const message of messages) {
    const correctMessage = correctMessages.find(({ id }) => id === message.id);
    assertIsDefined(correctMessage);
    expect(message.creator.id).toEqual(correctMessage.creatorId);
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
          actor,
          chatMessages,
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              chatMessages: [
                { creator: 'actor' },
                { creator: 'actor' },
                { creator: { name: 'bob' } },
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
      });

      it('Throws if item id is incorrect', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const itemId = v4();
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${itemId}/chat`,
        });

        expect(response.json().message).toMatch(new ItemNotFound(itemId).message);
      });

      it('Throws if member does not have access to item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              chatMessages: [
                { creator: 'actor' },
                { creator: 'actor' },
                { creator: { name: 'bob' } },
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

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });

    describe('Public', () => {
      it('Get successfully', async () => {
        const {
          items: [item],
          chatMessages,
        } = await seedFromJson({
          items: [
            {
              isPublic: true,
              chatMessages: [
                { creator: 'actor' },
                { creator: 'actor' },
                { creator: { name: 'bob' } },
              ],
            },
          ],
        });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check response value
        expectChatMessages(response.json(), chatMessages);
      });
    });
  });

  describe('POST /item-id/chat', () => {
    it('Throws for private item', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const payload = { body: 'hello' };

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Post successfully', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(payload.body);

        expect(await getMessagesByItemId(item.id)).toHaveLength(1);
      });

      it('Post successfully with mentions', async () => {
        const mailerService = resolveDependency(MailerService);
        const mock = jest.spyOn(mailerService, 'sendRaw');

        const {
          actor,
          items: [item],
          members,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }] }],
          members: [{ name: 'bob' }, { name: 'alice' }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          body: 'hello',
          mentions: members.map(({ id }) => id),
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(payload.body);

        expect(await getMessagesByItemId(item.id)).toHaveLength(1);

        // check mentions and send email
        for (const m of members) {
          const nbMention = await db.query.chatMentionsTable.findFirst({
            where: eq(chatMentionsTable.accountId, m.id),
          });
          expect(nbMention).toBeDefined();
        }
        expect(mock).toHaveBeenCalledTimes(members.length);
      });

      it('Throws if item id is incorrect', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = { body: 'hello' };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/invalid/chat`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if body is incorrect', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
          payload: { wrong: 'schema' },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = { body: 'hello' };
        const itemId = v4();
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${itemId}/chat`,
          payload,
        });

        expect(response.json().message).toMatch(new ItemNotFound(itemId).message);
      });

      it('Throws if member does not have access to item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = { body: 'hello' };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
          payload,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });
  });

  describe('PATCH /item-id/chat/message-id', () => {
    it('Throws for private item', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const payload = { body: 'hello' };

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${v4()}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Patch successfully', async () => {
        const {
          actor,
          items: [item],
          chatMessages: [chatMessage],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }], chatMessages: [{ creator: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = { body: 'hello' };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(payload.body);

        expect((await getMessagesByItemId(item.id))[0]).toBeDefined();
      });

      it('Throws if item id is incorrect', async () => {
        const {
          actor,
          chatMessages: [chatMessage],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }], chatMessages: [{ creator: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = { body: 'hello' };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/chat/${chatMessage.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if chat message id is incorrect', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = { body: 'hello' };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/invalid-id`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if body is incorrect', async () => {
        const {
          actor,
          items: [item],
          chatMessages: [chatMessage],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }], chatMessages: [{ creator: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
          payload: { wrong: 'payload' },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const {
          actor,
          chatMessages: [chatMessage],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }], chatMessages: [{ creator: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = { body: 'hello' };
        const itemId = v4();
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${itemId}/chat/${chatMessage.id}`,
          payload,
        });

        expect(response.json().message).toMatch(new ItemNotFound(itemId).message);
      });

      it('Throws if chat message does not exist', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = { body: 'hello' };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${v4()}`,
          payload,
        });

        expect(response.json()).toMatchObject(new ChatMessageNotFound(expect.anything()));
      });

      it('Throws if member does not have access to item', async () => {
        const {
          actor,
          items: [item],
          chatMessages: [chatMessage],
        } = await seedFromJson({
          items: [{ chatMessages: [{ creator: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = { body: 'hello' };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
          payload,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });

      it('Throws if member does not have access to chat message', async () => {
        const {
          actor,
          items: [item],
          chatMessages: [chatMessage],
        } = await seedFromJson({
          items: [
            { memberships: [{ account: 'actor' }], chatMessages: [{ creator: { name: 'bob' } }] },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = { body: 'hello' };
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
      const {
        items: [item],
      } = await seedFromJson({
        items: [{}],
      });

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${v4()}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Delete successfully', async () => {
        const {
          actor,
          items: [item],
          chatMessages: [chatMessage],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }], chatMessages: [{ creator: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().body).toEqual(chatMessage.body);

        expect(await getMessagesByItemId(item.id)).toHaveLength(0);
      });

      it('Throws if item id is incorrect', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/chat/${v4()}`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if chat message id is incorrect', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            { memberships: [{ account: 'actor' }], chatMessages: [{ creator: { name: 'bob' } }] },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/invalid-id`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const { actor } = await seedFromJson({
          items: [{}],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const itemId = v4();
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${itemId}/chat/${v4()}`,
        });

        expect(response.json().message).toMatch(new ItemNotFound(itemId).message);
      });

      it('Throws if chat message does not exist', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${v4()}`,
        });

        expect(response.json()).toMatchObject(new ChatMessageNotFound(expect.anything()));
      });

      it('Throws if member does not have access to item', async () => {
        const {
          actor,
          items: [item],
          chatMessages: [chatMessage],
        } = await seedFromJson({
          items: [{ chatMessages: [{ creator: 'actor' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat/${chatMessage.id}`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(item.id));
      });

      it('Throws if member does not have access to chat message', async () => {
        const {
          actor,
          items: [item],
          chatMessages: [chatMessage],
        } = await seedFromJson({
          items: [
            { memberships: [{ account: 'actor' }], chatMessages: [{ creator: { name: 'bob' } }] },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

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
      const {
        items: [item],
      } = await seedFromJson({
        items: [{}],
      });

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Delete all successfully', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              chatMessages: [
                { creator: { name: 'bob' } },
                { creator: { name: 'cedric' } },
                { creator: { name: 'alice' } },
              ],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

        expect(await getMessagesByItemId(item.id)).toHaveLength(0);
      });

      it('Throws if item id is incorrect', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/invalid-id/chat`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if item does not exist', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const itemId = v4();
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${itemId}/chat`,
        });

        expect(response.json().message).toEqual(new ItemNotFound(itemId).message);
      });

      it('Throws if member does not have access to item', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({ items: [{}] });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/chat`,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });
  });
});
