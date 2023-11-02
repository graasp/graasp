import { StatusCodes } from 'http-status-codes';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import {
  ANNA,
  ANNA_PROFILE,
  BOB,
  BOB_PROFILE,
  getDummyProfile,
  saveMemberProfile,
} from './fixtures/profile';

// mock datasource
jest.mock('../../../plugins/datasource');

describe('Profile Member routes tests', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('GET /member-profile/own', () => {
    it('Returns successfully if signed in', async () => {
      ({ app, actor } = await build());

      const response = await app.inject({
        method: HttpMethod.GET,
        url: '/member-profile/own',
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.GET,
        url: '/member-profile/own',
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('POST /member-profile', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const payload = getDummyProfile({ bio: 'Rnadom Bio' });
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/member-profile',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Create successfully', async () => {
        const payload = getDummyProfile({ bio: 'Rnadom Bio' });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/member-profile',
          payload,
        });

        // check response value
        const newMemberProfile = response.json();
        expect(newMemberProfile.bio).toBe(payload.bio);
        expect(response.statusCode).toBe(StatusCodes.CREATED);
      });
    });
  });

  describe('GET /member-profile/:id', () => {
    it('Returns Not Found if visibilty set to false', async () => {
      ({ app, actor } = await build());
      const member = await saveMemberProfile(ANNA, ANNA_PROFILE);
      const memberId = member.id;

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/member-profile/${memberId}`,
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('Returns member if visibilty set to true', async () => {
      ({ app, actor } = await build());
      const memberProfile = await saveMemberProfile(BOB, BOB_PROFILE);

      const memberId = memberProfile?.member?.id;

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/member-profile/${memberId}`,
      });
      const bobProfile = response.json();
      expect(bobProfile.bio).toBe(BOB_PROFILE.bio);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
  });

  describe('PATCH /member-profile', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const payload = getDummyProfile({ bio: 'Rnadom Bio' });
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: '/member-profile',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('updated successfully', async () => {
        const payload = getDummyProfile({ bio: 'Rnadom Bio' });
        await saveMemberProfile(actor, ANNA_PROFILE);

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: '/member-profile',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });
});
