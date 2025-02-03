import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { MEMBER_PROFILE_ROUTE_PREFIX } from '../../../../utils/config';
import { saveMember } from '../../test/fixtures/members';
import {
  ANNA_PROFILE,
  BOB_PROFILE,
  getDummyProfile,
  getMemberProfile,
  saveMemberProfile,
} from './test/fixtures/profile';

describe('Profile Member routes tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('GET /members/profile/own', () => {
    it('Returns successfully if signed in and profile not posted', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json()).toBeNull();
    });

    it('Returns successfully if signed in and profile posted', async () => {
      const { actor } = await seedFromJson({ actor: { profile: ANNA_PROFILE } });
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const ownProfile = await response.json();
      expect(ownProfile).toMatchObject(ANNA_PROFILE);
    });

    it('Returns successfully if signed in and profile not visible', async () => {
      const profile = { ...ANNA_PROFILE, visibility: false };
      const { actor } = await seedFromJson({ actor: { profile } });
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      const ownProfile = await response.json();
      expect(ownProfile).toMatchObject(profile);
    });

    it('Returns null if not set up', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      const ownProfile = await response.json();
      expect(ownProfile).toBeNull();
    });

    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('POST /members/profile', () => {
    it('Throws if signed out', async () => {
      const payload = getDummyProfile({ bio: 'Random Bio' });
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
        payload,
      });

      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Create successfully', async () => {
        const { actor } = await seedFromJson();
        mockAuthenticate(actor);

        const payload = getDummyProfile({ bio: 'Random Bio' });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
          payload,
        });

        // check response value
        const newMemberProfile = response.json();
        expect(newMemberProfile.bio).toEqual(payload.bio);
        expect(response.statusCode).toEqual(StatusCodes.CREATED);
      });

      it('Create Profile twice should respond with server error', async () => {
        const { actor } = await seedFromJson({ actor: { profile: ANNA_PROFILE } });
        mockAuthenticate(actor);
        const payload = getDummyProfile({ bio: 'Random Bio' });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
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
              ...ANNA_PROFILE,
              visibility: false,
            },
          },
        ],
      });
      mockAuthenticate(actor);
      const memberId = member.id;

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/${memberId}`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json()).toBeNull();
    });

    it('Returns OK and null data if no profile for this member', async () => {
      const {
        actor,
        members: [member],
      } = await seedFromJson({ members: [{}] });
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/${member.id}`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      expect(response.json()).toBeNull();
    });

    it('Returns profile if visibilty is true', async () => {
      const {
        actor,
        members: [member],
      } = await seedFromJson({ members: [{ profile: BOB_PROFILE }] });
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/${member.id}`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      const bobProfile = await response.json();
      expect(bobProfile.bio).toEqual(BOB_PROFILE.bio);
      expect(bobProfile.linkedinID).toEqual(BOB_PROFILE.linkedinID);
      expect(bobProfile.twitterID).toEqual(BOB_PROFILE.twitterID);
      expect(bobProfile.facebookID).toEqual(BOB_PROFILE.facebookID);
    });
  });

  describe('PATCH /members/profile', () => {
    it('Throws if signed out', async () => {
      const payload = getDummyProfile({ bio: 'Random Bio' });
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
        payload,
      });

      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('updated successfully', async () => {
        const actor = await saveMember();
        mockAuthenticate(actor);

        const memberProfile = await saveMemberProfile(actor, ANNA_PROFILE);
        const payload = { bio: 'Random Bio' };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
          payload,
        });

        const profile = await getMemberProfile(memberProfile?.id);
        expect(response.statusCode).toEqual(StatusCodes.OK);
        const res = await response.json();
        expect(res.bio).toEqual(profile.bio);
      });
    });
  });
});
