import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import qs from 'qs';

import { HttpMethod } from '@graasp/sdk';

import { CannotModifyOtherMembers, MemberNotFound } from '../src/util/graasp-error';
import build from './app';
import * as MEMBERS_FIXTURES from './fixtures/members';
import {
  mockMemberServiceDelete,
  mockMemberServiceGet,
  mockMemberServiceGetMatching,
  mockMemberServiceUpdate,
} from './mocks';

// mock auth, decorator and database plugins
jest.mock('../src/plugins/database');
jest.mock('../src/plugins/auth/auth');
jest.mock('../src/plugins/decorator');

describe('Member routes tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /members/current', () => {
    it('Returns successfully', async () => {
      mockMemberServiceGet([MEMBERS_FIXTURES.ACTOR]);
      const app = await build();

      const response = await app.inject({
        method: HttpMethod.GET,
        url: '/members/current',
      });

      const m = response.json();
      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(m.name).toEqual(MEMBERS_FIXTURES.ACTOR.name);
      expect(m.email).toEqual(MEMBERS_FIXTURES.ACTOR.email);
      expect(m.id).toEqual(MEMBERS_FIXTURES.ACTOR.id);
      expect(m.password).toBeUndefined();
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
  });

  describe('GET /members/:id', () => {
    it('Returns successfully', async () => {
      const member = MEMBERS_FIXTURES.BOB;
      mockMemberServiceGet([member]);
      const app = await build();
      const memberId = member.id;
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/members/${memberId}`,
      });

      const m = response.json();
      expect(m.name).toEqual(member.name);
      expect(m.email).toEqual(member.email);
      expect(m.id).toEqual(member.id);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });

    it('Returns Bad Request for invalid id', async () => {
      const app = await build();
      const memberId = 'invalid-id';
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/members/${memberId}`,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      app.close();
    });

    it('Returns MemberNotFound for invalid id', async () => {
      // the following id is not part of the fixtures
      const memberId = 'a3894999-c958-49c0-a5f0-f82dfebd941e';
      mockMemberServiceGet([]);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/members/${memberId}`,
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      expect(response.json()).toEqual(new MemberNotFound(memberId));
      app.close();
    });
  });

  // get many members
  describe('GET /members', () => {
    it('Returns successfully', async () => {
      const members = [MEMBERS_FIXTURES.ANNA, MEMBERS_FIXTURES.BOB];
      mockMemberServiceGet(members);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/members?${qs.stringify(
          { id: members.map(({ id }) => id) },
          { arrayFormat: 'repeat' },
        )}`,
      });
      const result = response.json();
      expect(result.length).toBeTruthy();
      result.forEach((m, idx) => {
        expect(m.email).toEqual(members[idx].email);
        expect(m.name).toEqual(members[idx].name);
        expect(m.id).toEqual(members[idx].id);
        expect(m.password).toBeFalsy();
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });

    it('Returns one member successfully', async () => {
      const members = [MEMBERS_FIXTURES.ANNA];
      mockMemberServiceGet(members);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/members?${qs.stringify({ id: members[0].id }, { arrayFormat: 'repeat' })}`,
      });

      const [m] = response.json();
      expect(m.email).toEqual(members[0].email);
      expect(m.name).toEqual(members[0].name);
      expect(m.id).toEqual(members[0].id);
      expect(m.password).toBeFalsy();
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });

    it('Returns Bad Request for one invalid id', async () => {
      const members = [
        MEMBERS_FIXTURES.ANNA,
        MEMBERS_FIXTURES.BOB,
        MEMBERS_FIXTURES.buildMember({ id: 'invalid-id' }),
      ];
      mockMemberServiceGet(members);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/members?${qs.stringify(
          { id: members.map(({ id }) => id) },
          { arrayFormat: 'repeat' },
        )}`,
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });

    it('Returns MemberNotFound for one missing id', async () => {
      // the following id is not part of the fixtures
      const memberId = 'a3894999-c958-49c0-a5f0-f82dfebd941e';
      const members = [MEMBERS_FIXTURES.ANNA, MEMBERS_FIXTURES.BOB];

      mockMemberServiceGet(members);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/members?${qs.stringify(
          { id: [memberId, ...members.map(({ id }) => id)] },
          { arrayFormat: 'repeat' },
        )}`,
      });

      expect(response.json()[0]).toEqual(new MemberNotFound(memberId));
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
  });

  describe('GET /members/search?email=<email>', () => {
    it('Returns successfully', async () => {
      const member = MEMBERS_FIXTURES.BOB;
      mockMemberServiceGetMatching([member]);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/members/search?email=${member.email}`,
      });

      const m = response.json()[0][0];
      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(m.name).toEqual(member.name);
      expect(m.id).toEqual(member.id);
      expect(m.email).toEqual(member.email);
      app.close();
    });

    it('Returns Bad Request for invalid email', async () => {
      const app = await build();
      const email = 'not-a-valid-email';
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/members/search?email=${email}`,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      app.close();
    });

    it('Returns empty array if no corresponding member is found', async () => {
      const email = 'empty@gmail.com';
      mockMemberServiceGetMatching([]);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/members/search?email=${email}`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json()).toEqual([[]]);
      app.close();
    });
  });

  describe('PATCH /members/:id', () => {
    it('Returns successfully', async () => {
      const member = MEMBERS_FIXTURES.ACTOR;
      const newName = 'new name';
      mockMemberServiceGet([member]);
      mockMemberServiceUpdate([member]);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/members/${member.id}`,
        payload: {
          name: newName,
          extra: {
            some: 'property',
          },
        },
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json().name).toEqual(newName);
      // todo: test whether extra is correctly modified (extra is not returned)
      app.close();
    });

    it('Current member cannot modify another member', async () => {
      const app = await build();
      const member = MEMBERS_FIXTURES.BOB;
      mockMemberServiceGet([member]);
      mockMemberServiceUpdate([member]);
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/members/${member.id}`,
        payload: {
          name: 'new name',
        },
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new CannotModifyOtherMembers(member.id));
      app.close();
    });
  });

  describe('DELETE /members/:id', () => {
    it('Returns successfully', async () => {
      const member = MEMBERS_FIXTURES.ACTOR;

      mockMemberServiceGet([member]);
      mockMemberServiceDelete([member]);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/members/${member.id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(response.json().name).toEqual(member.name);
      app.close();
    });

    it('Current member cannot delete another member', async () => {
      const app = await build();
      const member = MEMBERS_FIXTURES.BOB;
      mockMemberServiceGet([member]);
      mockMemberServiceDelete([member]);
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/members/${member.id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new CannotModifyOtherMembers(member.id));
      app.close();
    });
  });
});
