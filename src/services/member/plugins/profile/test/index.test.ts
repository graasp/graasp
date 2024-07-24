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

describe('Profile Member routes tests', () => {
  let app: FastifyInstance;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('GET /members/profile/own', () => {
    it('Returns successfully if signed in and profile not posted', async () => {
      ({ app, actor } = await build());

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Returns successfully if signed in and profile posted', async () => {
      ({ app, actor } = await build());
      await saveMemberProfile(actor, ANNA_PROFILE);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });
      expect(response.statusCode).toEqual(StatusCodes.OK);
      const ownProfile = await response.json();
      expect(ownProfile).toMatchObject(ANNA_PROFILE);
    });

    it('Returns successfully if signed in and profile not visible', async () => {
      ({ app, actor } = await build());
      const profile = { ...ANNA_PROFILE, visibility: false };
      await saveMemberProfile(actor, profile);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toEqual(StatusCodes.OK);
      const ownProfile = await response.json();
      expect(ownProfile).toMatchObject(profile);
    });

    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/own`,
      });

      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
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

      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
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
        expect(newMemberProfile.bio).toEqual(payload.bio);
        expect(response.statusCode).toEqual(StatusCodes.CREATED);
      });

      it('Create Profile twice should respond with server error', async () => {
        const payload = getDummyProfile({ bio: 'Random Bio' });
        await saveMemberProfile(actor, ANNA_PROFILE);

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
      ({ app, actor } = await build());
      const member = await saveMemberProfile(MemberFactory(), {
        ...ANNA_PROFILE,
        visibility: false,
      });
      const memberId = member.id;

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/${memberId}`,
      });

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Returns OK and null data if no profile for this member', async () => {
      ({ app, actor } = await build());
      const member = await saveMember();

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/${member.id}`,
      });

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Returns member if visibilty set to true', async () => {
      ({ app, actor } = await build());
      const memberProfile = await saveMemberProfile(MemberFactory(), BOB_PROFILE);

      const memberId = memberProfile?.member?.id;

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}/${memberId}`,
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
      ({ app } = await build({ member: null }));

      const payload = getDummyProfile({ bio: 'Random Bio' });
      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/members${MEMBER_PROFILE_ROUTE_PREFIX}`,
        payload,
      });

      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('updated successfully', async () => {
        const memberProfile = await saveMemberProfile(actor, ANNA_PROFILE);
        const payload = { id: 'i2345', bio: 'Random Bio' };

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
