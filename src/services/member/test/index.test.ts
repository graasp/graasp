import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { sign } from 'jsonwebtoken';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, MAX_USERNAME_LENGTH, MemberFactory } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../../test/app';
import { setupGuest } from '../../../../test/setup';
import { AppDataSource } from '../../../plugins/datasource';
import { DEFAULT_MAX_STORAGE } from '../../../services/item/plugins/file/utils/constants';
import { FILE_ITEM_TYPE, JWT_SECRET } from '../../../utils/config';
import { MemberNotFound } from '../../../utils/errors';
import { ItemTestUtils } from '../../item/test/fixtures/items';
import { Member } from '../entities/member';
import { saveMember, saveMembers } from './fixtures/members';

const testUtils = new ItemTestUtils();

const rawRepository = AppDataSource.getRepository(Member);

describe('Member routes tests', () => {
  let app: FastifyInstance;
  let actor;

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

  describe('GET /members/current', () => {
    it('Returns successfully if signed in', async () => {
      // inject login - necessary to fill lastAuthenticated correctly
      const member = await saveMember(MemberFactory({ isValidated: false }));
      const t = sign({ sub: member.id }, JWT_SECRET);
      await app.inject({
        method: HttpMethod.Get,
        url: `/auth?t=${t}`,
      });

      // mock authentication because the cookie is not set inbetween inject
      mockAuthenticate(member);

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current',
      });
      const m = response.json();

      expect(response.statusCode).toBe(StatusCodes.OK);
      expect(m.name).toEqual(member.name);
      expect(m.email).toEqual(member.email);
      expect(m.id).toEqual(member.id);
      expect(m.password).toBeUndefined();
    });

    it('Returns successfully if signed in as guest', async () => {
      const { guest } = await setupGuest(app);

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
      actor = await saveMember();
      mockAuthenticate(actor);

      const fileServiceType = FILE_ITEM_TYPE;

      // fill db with files
      const member = await saveMember();
      const { item: item1 } = await testUtils.saveItemAndMembership({
        item: {
          type: ItemType.S3_FILE,
          extra: {
            [ItemType.S3_FILE]: {
              size: 1234,
              content: 'content',
              mimetype: 'image/png',
              name: 'name',
              path: 'path',
            },
          },
        },
        member: actor,
      });
      const { item: item2 } = await testUtils.saveItemAndMembership({
        item: {
          type: ItemType.S3_FILE,
          extra: {
            [ItemType.S3_FILE]: {
              size: 534,
              content: 'content',
              mimetype: 'image/png',
              name: 'name',
              path: 'path',
            },
          },
        },
        member: actor,
      });

      const { item: item3 } = await testUtils.saveItemAndMembership({
        item: {
          type: ItemType.S3_FILE,
          extra: {
            [ItemType.S3_FILE]: {
              size: 8765,
              content: 'content',
              mimetype: 'image/png',
              name: 'name',
              path: 'path',
            },
          },
        },
        member: actor,
      });
      // noise data
      await testUtils.saveItemAndMembership({ member });

      const totalStorage =
        item1.extra[fileServiceType].size +
        item2.extra[fileServiceType].size +
        item3.extra[fileServiceType].size;

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
      actor = await saveMember();
      mockAuthenticate(actor);

      // fill db with noise data
      const member = await saveMember();
      await testUtils.saveItemAndMembership({
        item: {
          type: ItemType.S3_FILE,
          extra: {
            [ItemType.S3_FILE]: {
              size: 8765,
              content: 'content',
              mimetype: 'image/png',
              name: 'name',
              path: 'path',
            },
          },
        },
        member,
      });

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
        const member = await saveMember();
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
    });
    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Returns successfully', async () => {
        const member = await saveMember();
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
        const memberId = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members/${memberId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      });

      it('Returns MemberNotFound for invalid id', async () => {
        // the following id is not part of the fixtures
        const memberId = 'a3894999-c958-49c0-a5f0-f82dfebd941e';
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members/${memberId}`,
        });
        expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(response.json()).toEqual(new MemberNotFound({ id: memberId }));
      });
    });
  });

  // get many members
  describe('GET /members', () => {
    describe('Signed Out', () => {
      it('Returns successfully', async () => {
        const members = await saveMembers();

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/members',
          query: { id: members.map(({ id }) => id) },
        });
        const result = response.json();
        expect(result.data).toBeTruthy();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.values(result.data).forEach((m: any, idx) => {
          expect(m.email).toEqual(members[idx].email);
          expect(m.name).toEqual(members[idx].name);
          expect(m.id).toEqual(members[idx].id);
          expect(m.password).toBeFalsy();
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Returns successfully', async () => {
        const members = await saveMembers();

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/members',
          query: { id: members.map(({ id }) => id) },
        });
        const result = response.json();
        expect(result.data).toBeTruthy();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.values(result.data).forEach((m: any, idx) => {
          expect(m.email).toEqual(members[idx].email);
          expect(m.name).toEqual(members[idx].name);
          expect(m.id).toEqual(members[idx].id);
          expect(m.password).toBeFalsy();
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Returns one member successfully', async () => {
        const members = await saveMembers();

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/members',
          query: { id: members[0].id },
        });

        if (!members[0].id) {
          throw new Error();
        }

        const result = response.json();
        const m = result.data[members[0].id];
        expect(m.email).toEqual(members[0].email);
        expect(m.name).toEqual(members[0].name);
        expect(m.id).toEqual(members[0].id);
        expect(m.password).toBeFalsy();
        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Returns Bad Request for duplicate id', async () => {
        const members = await saveMembers();

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/members',
          query: { id: [members[0].id, members[0].id] },
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Returns Bad Request for one invalid id', async () => {
        await saveMembers();

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/members',
          query: { id: 'invalid-id' },
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Returns MemberNotFound for one missing id', async () => {
        // the following id is not part of the fixtures
        const memberId = 'a3894999-c958-49c0-a5f0-f82dfebd941e';
        const members = await saveMembers();

        const response = await app.inject({
          method: HttpMethod.Get,
          url: '/members',
          query: { id: [memberId, ...members.map(({ id }) => id)] },
        });

        // TODO: currently we do not return empty values
        expect(response.json().errors[0]).toEqual(new MemberNotFound({ id: memberId }));
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });

  describe('GET /members/search?email=<email>', () => {
    describe('Signed Out', () => {
      it('Returns successfully', async () => {
        const member = await saveMember();
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members/search?email=${member.email}`,
        });
        if (!member.email) {
          throw new Error();
        }

        const m = response.json().data[member.email];
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(m.name).toEqual(member.name);
        expect(m.id).toEqual(member.id);
        expect(m.email).toEqual(member.email);
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Returns successfully', async () => {
        const member = await saveMember();
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members/search?email=${member.email}`,
        });
        if (!member.email) {
          throw new Error();
        }

        const m = response.json().data[member.email];
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(m.name).toEqual(member.name);
        expect(m.id).toEqual(member.id);
        expect(m.email).toEqual(member.email);
      });

      // TODO: fails because schema is disabled
      it('Returns Bad Request for invalid email', async () => {
        const email = 'not-a-valid-email';
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members/search?email=${email}`,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      });

      it('Returns empty array if no corresponding member is found', async () => {
        const email = 'empty@gmail.com';

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members/search?email=${email}`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().errors[0]).toEqual(new MemberNotFound({ email }));
      });

      /**
       * Regression test for https://github.com/graasp/graasp/issues/1128
       * `.swiss` extension did not pass the email regex validation and
       * results were stripped out by AJV.
       */
      it('Returns emails with longer domains', async () => {
        const member = await saveMember(MemberFactory({ email: 'bob@edu.swiss' }));
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members/search?email=${member.email}`,
        });
        if (!member.email) {
          throw new Error();
        }

        const m = response.json().data[member.email];
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(m.name).toEqual(member.name);
        expect(m.id).toEqual(member.id);
        expect(m.email).toEqual(member.email);
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
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Returns successfully', async () => {
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

        const m = await rawRepository.findOneBy({ id: actor.id });
        expect(m?.name).toEqual(newName);

        expect(response.statusCode).toBe(StatusCodes.OK);

        const result = await response.json();
        expect(result.name).toEqual(newName);
        // todo: test whether extra is correctly modified (extra is not returned)
        expect(result.extra).toMatchObject(newExtra);
      });

      it('New name too short throws', async () => {
        const newName = 'n';

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/current`,
          payload: {
            name: newName,
          },
        });

        const m = await rawRepository.findOneBy({ id: actor.id });
        expect(m?.name).toEqual(actor.name);

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('New name too long throws', async () => {
        const newName = Array(MAX_USERNAME_LENGTH + 1).fill(() => 'a');

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/current`,
          payload: {
            name: newName,
          },
        });

        const m = await rawRepository.findOneBy({ id: actor.id });
        expect(m?.name).toEqual(actor.name);

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Enable save actions successfully', async () => {
        const enableSaveActions = true;
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/current`,
          payload: { enableSaveActions },
        });

        const m = await rawRepository.findOneBy({ id: actor.id });
        expect(m?.enableSaveActions).toEqual(enableSaveActions);

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().enableSaveActions).toEqual(enableSaveActions);
      });

      it('Disable save actions successfully', async () => {
        // Start by enabling save actions
        await app.inject({
          method: HttpMethod.Patch,
          url: `/members/current`,
          payload: { enableSaveActions: true },
        });
        const memberBeforePatch = await rawRepository.findOneBy({ id: actor.id });
        expect(memberBeforePatch?.enableSaveActions).toBe(true);

        const enableSaveActions = false;
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/current`,
          payload: { enableSaveActions },
        });

        const m = await rawRepository.findOneBy({ id: actor.id });
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
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });
      it('Returns successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/members/current`,
        });

        const m = await rawRepository.findOneBy({ id: actor.id });
        expect(m).toBeFalsy();

        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      });
    });
  });
});
