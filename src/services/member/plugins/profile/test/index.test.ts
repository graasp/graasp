import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod, MemberFactory } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { MEMBER_PROFILE_ROUTE_PREFIX } from '../../../../../utils/config';
import { saveMember } from '../../../test/fixtures/members';
import {
  ANNA_PROFILE,
  BOB_PROFILE,
  getDummyProfile,
  getMemberProfile,
  saveMemberProfile,
} from './fixtures/profile';

// mock datasource
jest.mock('../../../../../plugins/datasource');

describe('Profile Member routes tests', () => {
  let app: FastifyInstance;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    void app.close();
  });

  describe('GET /members/profile/own', () => {
    it('Returns successfully if signed in and profile not posted', async () => {
      ({ app, actor } = await build());

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });
      const ownProfile = response.json();
      expect(ownProfile).toBeNull();
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    it('Returns successfully if signed in and profile posted', async () => {
      ({ app, actor } = await build());
      await saveMemberProfile(actor, ANNA_PROFILE);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });
      const ownProfile = response.json();
      expect(ownProfile.bio).toBe(ANNA_PROFILE.bio);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    it('Returns successfully if signed in and profile unvisible', async () => {
      ({ app, actor } = await build());
      await saveMemberProfile(actor, { ...ANNA_PROFILE, visibility: false });

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });
      const ownProfile = response.json();
      expect(ownProfile.bio).toBe(ANNA_PROFILE.bio);
      expect(ownProfile.visibility).toBe(false);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('POST /members/profile', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const payload = getDummyProfile({ bio: 'Random Bio' });
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Create successfully', async () => {
        const payload = getDummyProfile({ bio: 'Random Bio' });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
          payload,
        });

        // check response value
        const newMemberProfile = response.json();
        expect(newMemberProfile.bio).toBe(payload.bio);
        expect(response.statusCode).toBe(StatusCodes.CREATED);
      });

      it('Create Profile twice should response with server error', async () => {
        const payload = getDummyProfile({ bio: 'Random Bio' });
        await saveMemberProfile(actor, ANNA_PROFILE);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      });
    });
  });

  describe('GET /members/profile/:id', () => {
    it('Returns OK and null data if visibilty set to false', async () => {
      ({ app, actor } = await build());
      const member = await saveMemberProfile(MemberFactory(), ANNA_PROFILE);
      const memberId = member.id;

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/${memberId}`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json()).toBeFalsy();
    });
    it('Returns OK and null data if no profile for this member', async () => {
      ({ app, actor } = await build());
      const member = await saveMember();
      const memberId = member.id;

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/${memberId}`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json()).toBeFalsy();
    });
    it('Returns member if visibilty set to true', async () => {
      ({ app, actor } = await build());
      const memberProfile = await saveMemberProfile(MemberFactory(), BOB_PROFILE);

      const memberId = memberProfile?.member?.id;

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/${memberId}`,
      });
      const bobProfile = response.json();
      expect(bobProfile.bio).toBe(BOB_PROFILE.bio);
      expect(bobProfile.linkedinID).toBe(BOB_PROFILE.linkedinID);
      expect(bobProfile.twitterID).toBe(BOB_PROFILE.twitterID);
      expect(bobProfile.facebookID).toBe(BOB_PROFILE.facebookID);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
  });

  describe('PATCH /members/profile', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const payload = getDummyProfile({ bio: 'Random Bio' });
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('updated successfully', async () => {
        const payload = getDummyProfile({ bio: 'Random Bio' });
        const member = await saveMemberProfile(actor, ANNA_PROFILE);

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
          payload,
        });
        const profile = await getMemberProfile(member?.id);

        expect(profile?.bio).toBe(payload.bio);
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });
});
