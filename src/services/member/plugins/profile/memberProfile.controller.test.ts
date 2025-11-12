import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';

import type { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { memberProfilesTable } from '../../../../drizzle/schema';
import type { MemberProfileRaw } from '../../../../drizzle/types';
import { assertIsDefined } from '../../../../utils/assertions';
import { MEMBER_PROFILE_ROUTE_PREFIX } from '../../../../utils/config';

const expectProfile = (
  profile: Pick<MemberProfileRaw, 'linkedinId' | 'facebookId' | 'twitterId' | 'bio'>,
  expected: Pick<MemberProfileRaw, 'linkedinId' | 'facebookId' | 'twitterId' | 'bio'>,
) => {
  expect(profile.linkedinId).toEqual(expected.linkedinId);
  expect(profile.facebookId).toEqual(expected.facebookId);
  expect(profile.twitterId).toEqual(expected.twitterId);
  expect(profile.bio).toEqual(expected.bio);
};

describe('Profile Member routes tests', () => {
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

  describe('GET /members/profile/own', () => {
    it('Returns successfully if signed in and profile not posted', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json()).toBeNull();
    });

    it('Returns successfully if signed in and profile posted', async () => {
      const {
        actor,
        memberProfiles: [profile],
      } = await seedFromJson({ actor: { profile: {} } });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      const ownProfile = await response.json();
      expectProfile(ownProfile, profile);
    });

    it('Returns successfully if signed in and profile not visible', async () => {
      const {
        actor,
        memberProfiles: [profile],
      } = await seedFromJson({ actor: { profile: { visibility: false } } });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      const ownProfile = await response.json();
      expectProfile(ownProfile, profile);
    });

    it('Returns null if not set up', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      const ownProfile = await response.json();
      expect(ownProfile).toBeNull();
    });

    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('POST /members/profile', () => {
    it('Throws if signed out', async () => {
      const payload = {
        bio: 'Random Bio',
        facebookId: faker.word.sample(),
        linkedinId: faker.word.sample(),
        twitterId: faker.word.sample(),
        visibility: true,
      };
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
        payload,
      });

      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Create successfully', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          bio: 'Random Bio',
          facebookId: faker.word.sample(),
          linkedinId: faker.word.sample(),
          twitterId: faker.word.sample(),
          visibility: true,
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
          payload,
        });

        expect(response.statusCode).toEqual(StatusCodes.CREATED);
        // check response value
        const newMemberProfile = response.json();
        expectProfile(newMemberProfile, payload);
      });

      it('Create Profile twice should respond with server error', async () => {
        const { actor } = await seedFromJson({ actor: { profile: {} } });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          bio: 'Random Bio',
          facebookId: faker.word.sample(),
          linkedinId: faker.word.sample(),
          twitterId: faker.word.sample(),
          visibility: true,
        };

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
          payload,
        });

        expect(response.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      });
    });
  });

  describe('GET /members/profile/:id', () => {
    it('Returns OK and null data if visibilty set to false', async () => {
      const {
        actor,
        members: [member],
      } = await seedFromJson({
        members: [
          {
            profile: {
              visibility: false,
            },
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      const memberId = member.id;
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}/${memberId}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json()).toBeNull();
    });
    it('Returns OK and null data if no profile for this member', async () => {
      const {
        actor,
        members: [member],
      } = await seedFromJson({ members: [{}] });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}/${member.id}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);

      expect(response.json()).toBeNull();
    });
    it('Returns profile if visibilty is true', async () => {
      const {
        actor,
        members: [member],
        memberProfiles: [profile],
      } = await seedFromJson({ members: [{ profile: { visibility: true } }] });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}/${member.id}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);

      const bobProfile = await response.json();
      expectProfile(bobProfile, profile);
    });
  });
  describe('PATCH /members/profile', () => {
    it('Throws if signed out', async () => {
      const payload = { bio: 'Random Bio' };
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
        payload,
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
    describe('Signed In', () => {
      it('updated successfully', async () => {
        const { actor } = await seedFromJson({ actor: { profile: {} } });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = { bio: 'Random Bio' };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
          payload,
        });

        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        const res = await db.query.memberProfilesTable.findFirst({
          where: eq(memberProfilesTable.memberId, actor.id),
        });
        assertIsDefined(res);
        expect(res.bio).toEqual(payload.bio);
      });
    });
  });
});
