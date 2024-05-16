import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import qs from 'qs';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, MAX_USERNAME_LENGTH } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../test/app';
import { DEFAULT_MAX_STORAGE } from '../../../services/item/plugins/file/utils/constants';
import { FILE_ITEM_TYPE } from '../../../utils/config';
import { CannotModifyOtherMembers, MemberNotFound } from '../../../utils/errors';
import { ItemTestUtils } from '../../item/test/fixtures/items';
import MemberRepository from '../repository';
import { saveMember, saveMembers } from './fixtures/members';

// mock datasource
jest.mock('../../../plugins/datasource');
const testUtils = new ItemTestUtils();

describe('Member routes tests', () => {
  let app: FastifyInstance;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    await app.close();
  });

  describe('GET /members/current', () => {
    it('Returns successfully if signed in', async () => {
      ({ app, actor } = await build());

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
      expect(response.statusCode).toBe(StatusCodes.OK);
    });
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current',
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('GET /members/current/storage', () => {
    it('Returns successfully if signed in', async () => {
      ({ app, actor } = await build());

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
      ({ app, actor } = await build());

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
      ({ app } = await build({ member: null }));

      const response = await app.inject({
        method: HttpMethod.Get,
        url: '/members/current/storage',
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('GET /members/:id', () => {
    describe('Signed Out', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
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
    });
    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
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
        expect(response.json()).toEqual(new MemberNotFound(memberId));
      });
    });
  });

  // get many members
  describe('GET /members', () => {
    describe('Signed Out', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
      });

      it('Returns successfully', async () => {
        const members = await saveMembers();

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members?${qs.stringify(
            { id: members.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
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
        ({ app, actor } = await build());
      });

      it('Returns successfully', async () => {
        const members = await saveMembers();

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members?${qs.stringify(
            { id: members.map(({ id }) => id) },
            { arrayFormat: 'repeat' },
          )}`,
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
          url: `/members?${qs.stringify({ id: members[0].id }, { arrayFormat: 'repeat' })}`,
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
          url: `/members?${qs.stringify(
            { id: [members[0].id, members[0].id] },
            { arrayFormat: 'repeat' },
          )}`,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Returns Bad Request for one invalid id', async () => {
        const members = await saveMembers();

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/members?${qs.stringify(
            { id: [members.map(({ id }) => id), 'invalid-id'] },
            { arrayFormat: 'repeat' },
          )}`,
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
          url: `/members?${qs.stringify(
            { id: [memberId, ...members.map(({ id }) => id)] },
            { arrayFormat: 'repeat' },
          )}`,
        });

        // TODO: currently we do not return empty values
        expect(response.json().errors[0]).toEqual(new MemberNotFound(memberId));
        expect(response.statusCode).toBe(StatusCodes.OK);
      });
    });
  });

  describe('GET /members/search?email=<email>', () => {
    describe('Signed Out', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
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
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
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
        expect(response.json().errors[0]).toEqual(new MemberNotFound(email));
      });
    });
  });

  describe('PATCH /members/:id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const newName = 'new name';

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/members/${actor.id}`,
        payload: {
          name: newName,
          extra: {
            some: 'property',
          },
        },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Returns successfully', async () => {
        const newName = 'new name';

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/${actor.id}`,
          payload: {
            name: newName,
            extra: {
              some: 'property',
            },
          },
        });

        const m = await MemberRepository.findOneBy({ id: actor.id });
        expect(m?.name).toEqual(newName);

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().name).toEqual(newName);
        // todo: test whether extra is correctly modified (extra is not returned)
      });

      it('New name too short throws', async () => {
        const newName = 'n';

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/${actor.id}`,
          payload: {
            name: newName,
          },
        });

        const m = await MemberRepository.findOneBy({ id: actor.id });
        expect(m?.name).toEqual(actor.name);

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('New name too long throws', async () => {
        const newName = Array(MAX_USERNAME_LENGTH + 1).fill(() => 'a');

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/${actor.id}`,
          payload: {
            name: newName,
          },
        });

        const m = await MemberRepository.findOneBy({ id: actor.id });
        expect(m?.name).toEqual(actor.name);

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Enable save actions successfully', async () => {
        const enableSaveActions = true;
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/${actor.id}`,
          payload: { enableSaveActions },
        });

        const m = await MemberRepository.findOneBy({ id: actor.id });
        expect(m?.enableSaveActions).toEqual(enableSaveActions);

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().enableSaveActions).toEqual(enableSaveActions);
      });

      it('Disable save actions successfully', async () => {
        // Start by enabling save actions
        await app.inject({
          method: HttpMethod.Patch,
          url: `/members/${actor.id}`,
          payload: { enableSaveActions: true },
        });
        const memberBeforePatch = await MemberRepository.findOneBy({ id: actor.id });
        expect(memberBeforePatch?.enableSaveActions).toBe(true);

        const enableSaveActions = false;
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/${actor.id}`,
          payload: { enableSaveActions },
        });

        const m = await MemberRepository.findOneBy({ id: actor.id });
        expect(m?.enableSaveActions).toEqual(enableSaveActions);

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json().enableSaveActions).toEqual(enableSaveActions);
      });

      it('Current member cannot modify another member', async () => {
        const member = await saveMember();
        const newName = 'new name';
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/members/${member.id}`,
          payload: {
            name: newName,
          },
        });

        const m = await MemberRepository.findOneBy({ id: member.id });
        expect(m?.name).not.toEqual(newName);

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new CannotModifyOtherMembers(member.id));
      });
    });
  });

  describe('DELETE /members/:id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember();

      const response = await app.inject({
        method: HttpMethod.Delete,
        url: `/members/${member.id}`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });
      it('Returns successfully', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/members/${actor.id}`,
        });

        const m = await MemberRepository.findOneBy({ id: actor.id });
        expect(m).toBeFalsy();

        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      });

      it('Current member cannot delete another member', async () => {
        const member = await saveMember();
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/members/${member.id}`,
        });

        const m = await MemberRepository.findOneBy({ id: member.id });
        expect(m).toBeTruthy();

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json()).toEqual(new CannotModifyOtherMembers(member.id));
      });
    });
  });
});
