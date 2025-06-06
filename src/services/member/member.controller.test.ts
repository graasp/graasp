import { eq } from 'drizzle-orm';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, ItemLoginSchemaType, ItemType, MAX_USERNAME_LENGTH } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../test/app';
import { MemberFactory } from '../../../test/factories/member.factory';
import { seedFromJson } from '../../../test/mocks/seed';
import { db } from '../../drizzle/db';
import { accountsTable } from '../../drizzle/schema';
import { assertIsDefined } from '../../utils/assertions';
import { MemberNotFound } from '../../utils/errors';
import { assertIsMember, assertIsMemberForTest } from '../authentication';
import { DEFAULT_MAX_STORAGE } from '../item/plugins/file/utils/constants';

const getMemberUtil = async (actorId: string) => {
  return await db.query.accountsTable.findFirst({ where: eq(accountsTable.id, actorId) });
};

describe('Member routes tests', () => {
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

  describe('GET /members/current', () => {
    it('Returns successfully if signed in', async () => {
      // inject login - necessary to fill lastAuthenticated correctly
      const { actor } = await seedFromJson({
        actor: MemberFactory({
          isValidated: false,
          lastAuthenticatedAt: new Date().toISOString(),
        }),
      });

      // mock authentication because the cookie is not set inbetween inject
      assertIsDefined(actor);
      assertIsMember(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current',
      });
      const m = response.json();

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(m.name).toEqual(actor.name);
      expect(m.email).toEqual(actor.email);
      expect(m.id).toEqual(actor.id);
      expect(m.password).toBeUndefined();
    });

    it('Returns successfully if signed in as guest', async () => {
      const {
        guests: [guest],
      } = await seedFromJson({
        items: [
          {
            itemLoginSchema: { guests: [{}], type: ItemLoginSchemaType.Username },
          },
        ],
      });

      mockAuthenticate(guest);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current',
      });
      const m = response.json();
      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(m.name).toEqual(guest.name);
      expect(m.id).toEqual(guest.id);
      expect(m.email).toBeUndefined();
      expect(m.password).toBeUndefined();
    });
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current',
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('GET /members/current/storage', () => {
    it('Returns successfully if signed in', async () => {
      const { actor, items } = await seedFromJson({
        items: [
          {
            type: ItemType.FILE,
            extra: {
              [ItemType.FILE]: {
                size: 1234,
                content: 'content',
                mimetype: 'image/png',
                name: 'name',
                path: 'path',
              },
            },
            creator: 'actor',
            memberships: [{ account: 'actor' }],
          },
          {
            type: ItemType.FILE,
            extra: {
              [ItemType.FILE]: {
                size: 534,
                content: 'content',
                mimetype: 'image/png',
                name: 'name',
                path: 'path',
              },
            },
            creator: 'actor',
            memberships: [{ account: 'actor' }],
          },
          {
            type: ItemType.FILE,
            extra: {
              [ItemType.FILE]: {
                size: 8765,
                content: 'content',
                mimetype: 'image/png',
                name: 'name',
                path: 'path',
              },
            },
            creator: 'actor',
            memberships: [{ account: 'actor' }],
          },
          // noise
          {
            creator: 'actor',
            memberships: [{ account: 'actor' }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const totalStorage = items.reduce((acc, i) => {
        if (i.type !== ItemType.FILE) {
          return acc;
        }
        return acc + i.extra[ItemType.FILE]?.size;
      }, 0);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage',
      });
      const { current, maximum } = response.json();
      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(current).toEqual(totalStorage);
      expect(maximum).toEqual(DEFAULT_MAX_STORAGE);
    });
    it('Returns successfully if empty items', async () => {
      const { actor } = await seedFromJson({
        items: [
          // noise
          {
            type: ItemType.FILE,
            extra: {
              [ItemType.FILE]: {
                size: 8765,
                content: 'content',
                mimetype: 'image/png',
                name: 'name',
                path: 'path',
              },
            },
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage',
      });
      const { current, maximum } = response.json();
      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(current).toEqual(0);
      expect(maximum).toEqual(DEFAULT_MAX_STORAGE);
    });
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage',
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('GET /members/:id', () => {
    describe('Signed Out', () => {
      it('Returns successfully', async () => {
        const {
          members: [member],
        } = await seedFromJson({ members: [{}] });
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members/${member.id}`,
        });

        const m = response.json();
        expect(m.name).toEqual(member.name);
        expect(m.email).toEqual(member.email);
        expect(m.id).toEqual(member.id);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
    describe('Signed In', () => {
      it('Returns successfully', async () => {
        const {
          actor,
          members: [member],
        } = await seedFromJson({ members: [{}] });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const memberId = member.id;
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members/${memberId}`,
        });

        const m = response.json();
        expect(m.name).toEqual(member.name);
        expect(m.email).toEqual(member.email);
        expect(m.id).toEqual(member.id);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Returns Bad Request for invalid id', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members/invalid-id`,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      });

      it('Returns MemberNotFound for invalid id', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);
        const memberId = v4();
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members/${memberId}`,
        });
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(response.json().message).toEqual(new MemberNotFound({ id: memberId }).message);
      });
    });
  });

  describe('PATCH /members/current', () => {
    it('Throws if signed out', async () => {
      const newName = 'new name';

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/members/current`,
        payload: {
          name: newName,
          extra: {
            some: 'property',
          },
        },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In as Member', () => {
      it('Returns successfully', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const newName = 'new name';
        const newExtra = {
          some: 'property',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/current`,
          payload: {
            name: newName,
            extra: newExtra,
          },
        });

        const m = await getMemberUtil(actor.id);
        expect(m?.name).toEqual(newName);

        expect(response.statusCode).toBe(StatusCodes.OK);

        const result = await response.json();
        expect(result.name).toEqual(newName);
        // todo: test whether extra is correctly modified (extra is not returned)
        expect(result.extra).toMatchObject(newExtra);
      });

      it('New name too short throws', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const newName = 'n';

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/current`,
          payload: {
            name: newName,
          },
        });

        const m = await getMemberUtil(actor.id);
        expect(m?.name).toEqual(actor.name);

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('New name too long throws', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const newName = Array(MAX_USERNAME_LENGTH + 1).fill(() => 'a');

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/current`,
          payload: {
            name: newName,
          },
        });

        const m = await getMemberUtil(actor.id);
        expect(m?.name).toEqual(actor.name);

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Enable save actions successfully', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const enableSaveActions = true;
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/current`,
          payload: { enableSaveActions },
        });

        const m = await getMemberUtil(actor.id);
        expect(m?.enableSaveActions).toEqual(enableSaveActions);

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().enableSaveActions).toEqual(enableSaveActions);
      });

      it('Disable save actions successfully', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        // Start by enabling save actions
        await app.inject({
          method: HttpMethod.Patch,
          url: `/members/current`,
          payload: { enableSaveActions: true },
        });
        const memberBeforePatch = await db.query.accountsTable.findFirst({
          where: eq(accountsTable.id, actor.id),
        });
        expect(memberBeforePatch?.enableSaveActions).toBe(true);

        const enableSaveActions = false;
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/current`,
          payload: { enableSaveActions },
        });

        const m = await getMemberUtil(actor.id);
        expect(m?.enableSaveActions).toEqual(enableSaveActions);

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().enableSaveActions).toEqual(enableSaveActions);
      });
    });
  });

  describe('DELETE /members/current', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/members/current`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Returns successfully', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        assertIsMember(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/members/current`,
        });

        const m = await getMemberUtil(actor.id);
        expect(m).toBeFalsy();

        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      });
    });
  });
});
