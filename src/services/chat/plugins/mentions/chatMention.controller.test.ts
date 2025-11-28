import { eq, inArray } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, MentionStatus } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { chatMentionsTable } from '../../../../drizzle/schema';
import type { AccountRaw, ChatMentionRaw, ChatMessageRaw } from '../../../../drizzle/types';
import type { MinimalMember } from '../../../../types';
import { assertIsDefined } from '../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { MemberCannotAccessMention } from '../../errors';

// create item, chat messages from another member and members
// as well as mentions of actor
const saveItemWithChatMessagesAndMentions = async () => {
  const {
    actor,
    items: [item],
    chatMessages,
    members,
  } = await seedFromJson({
    items: [
      {
        chatMessages: [
          { creator: { name: 'one' } },
          { creator: { name: 'two' } },
          { creator: { name: 'three' } },
        ],
      },
    ],
  });
  assertIsDefined(actor);
  const chatMentions = await db
    .insert(chatMentionsTable)
    .values(chatMessages.map((m) => ({ messageId: m.id, accountId: actor.id })))
    .returning();

  return { item, chatMessages, members, chatMentions, actor };
};

describe('Chat Mention tests', () => {
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

  describe('GET /mentions', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `${ITEMS_ROUTE_PREFIX}/mentions`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Get successfully', async () => {
        const { chatMentions, actor } = await saveItemWithChatMessagesAndMentions();
        mockAuthenticate(actor);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/mentions`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        const result = await response.json();
        // check response value
        expect(result).toHaveLength(chatMentions.length);
        for (const m of result) {
          const correctMention = chatMentions.find(({ id }) => id === m.id)!;

          expect(m.message.id).toEqual(correctMention.messageId);
          expect(m.message.creatorId).toBeDefined();
          expect(m.account.id).toEqual(correctMention.accountId);
        }
      });
    });
  });

  describe('PATCH /items/mentions/mention-id', () => {
    it('Throws if signed out', async () => {
      const payload = { status: MentionStatus.Read };

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `${ITEMS_ROUTE_PREFIX}/mentions/${v4()}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let chatMentions: ChatMentionRaw[];
      let actor: AccountRaw;
      const payload = { status: MentionStatus.Read };

      beforeEach(async () => {
        ({ chatMentions, actor } = await saveItemWithChatMessagesAndMentions());
        mockAuthenticate(actor);
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
        const id = v4();
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/${id}`,
          payload,
        });

        expect(response.json()).toMatchObject({
          code: 'GICERR006',
          message: `Chat mention not found ${id}`,
          statusCode: StatusCodes.NOT_FOUND,
        });
      });

      it('Throws if member does not have access to mention', async () => {
        // create brand new user because fixtures are used for chatmessages and will already exists
        const {
          actor,
          chatMentions: [mention],
        } = await seedFromJson({
          items: [
            {
              chatMessages: [{ creator: 'actor', mentions: [{ name: 'bob' }] }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/${mention.id}`,
          payload,
        });

        expect(response.json()).toMatchObject(new MemberCannotAccessMention(mention));
      });
    });
  });

  describe('DELETE /item-id/chat/message-id', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/mentions/${v4()}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let chatMentions: ChatMentionRaw[];
      let chatMessages: ChatMessageRaw[];
      let members: MinimalMember[];
      let actor: AccountRaw;

      beforeEach(async () => {
        ({ chatMessages, chatMentions, members, actor } =
          await saveItemWithChatMessagesAndMentions());
        mockAuthenticate(actor);
      });

      it('Delete successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/${chatMentions[0].id}`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        const result = await response.json();
        expect(result.id).toEqual(chatMentions[0].id);

        expect(
          await db.$count(
            chatMentionsTable,
            inArray(
              chatMentionsTable.id,
              chatMentions.map(({ id }) => id),
            ),
          ),
        ).toEqual(chatMentions.length - 1);
        expect(
          await db.query.chatMentionsTable.findFirst({
            where: eq(chatMentionsTable.id, chatMentions[0].id),
          }),
        ).toBeUndefined();
      });

      it('Throws if chat mention id is incorrect', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/invalid-id`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throws if chat mention does not exist', async () => {
        const id = v4();
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/${id}`,
        });
        const result = await response.json();
        expect(result).toMatchObject({
          code: 'GICERR006',
          message: `Chat mention not found ${id}`,
          statusCode: 404,
        });
      });

      it('Throws if member does not have access to chat message', async () => {
        const [mention] = await db
          .insert(chatMentionsTable)
          .values({
            messageId: chatMessages[0].id,
            accountId: members[0].id,
          })
          .returning();

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/mentions/${mention.id}`,
        });

        expect(response.json()).toMatchObject(
          new MemberCannotAccessMention({ id: expect.anything() }),
        );
      });
    });
  });

  describe('DELETE /mentions', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/mentions`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    it('Delete all successfully when signed in', async () => {
      const { chatMessages, members, actor } = await saveItemWithChatMessagesAndMentions();
      mockAuthenticate(actor);

      // more messages
      const message = chatMessages[0];

      const otherMentions = await db
        .insert(chatMentionsTable)
        .values(members.slice(0, 3).map((mem) => ({ accountId: mem.id, messageId: message.id })))
        .returning();

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `${ITEMS_ROUTE_PREFIX}/mentions`,
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);

      expect(await db.$count(chatMentionsTable, eq(chatMentionsTable.accountId, actor.id))).toEqual(
        0,
      );
      expect(
        await db.$count(
          chatMentionsTable,
          inArray(
            chatMentionsTable.messageId,
            otherMentions.map((oM) => oM.messageId),
          ),
        ),
      ).toEqual(otherMentions.length);
    });
  });
});
