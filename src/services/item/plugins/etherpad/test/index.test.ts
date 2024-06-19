import { StatusCodes } from 'http-status-codes';
import { DateTime } from 'luxon';
import nock from 'nock';
import { And, Not } from 'typeorm';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { EtherpadItemType, HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app.js';
import { waitForExpect } from '../../../../../../test/assertions/waitForExpect.js';
import { ETHERPAD_PUBLIC_URL } from '../../../../../utils/config.js';
import { ItemNotFound, MemberCannotAccess } from '../../../../../utils/errors.js';
import { Actor, Member } from '../../../../member/entities/member.js';
import { saveMember } from '../../../../member/test/fixtures/members.js';
import { Item } from '../../../entities/Item.js';
import { ItemTestUtils } from '../../../test/fixtures/items.js';
import { MAX_SESSIONS_IN_COOKIE } from '../constants.js';
import { ItemMissingExtraError } from '../errors.js';
import { EtherpadItemService } from '../service.js';
import { setUpApi } from './api.js';

// mock datasource
jest.mock('../../../../../plugins/datasource');
const testUtils = new ItemTestUtils();

const MOCK_GROUP_ID = 'g.s8oes9dhwrvt0zif';
const MOCK_PAD_READ_ONLY_ID = 'r.s8oes9dhwrvt0zif';
const MOCK_PAD_NAME = 'mock-pad-name';
// eslint-disable-next-line no-useless-escape
const MOCK_PAD_ID = `${MOCK_GROUP_ID}\$${MOCK_PAD_NAME}`;
const MOCK_AUTHOR_ID = 'a.s8oes9dhwrvt0zif';
const MOCK_SESSION_ID = 's.s8oes9dhwrvt0zif';
const MODES: ('read' | 'write')[] = ['read', 'write'];

describe('Etherpad service API', () => {
  let app: FastifyInstance;
  let member: Member;

  const payloadCreate = {
    method: HttpMethod.Post,
    url: 'items/etherpad/create',
    payload: {
      name: 'test-item-name',
    },
  };

  beforeEach(async () => {
    let actor: Actor;
    ({ app, actor } = await build());
    if (!actor) {
      throw new Error('Test error: member should be defined');
    }
    member = actor;
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
    nock.cleanAll();
  });

  describe('create a pad', () => {
    it('creates a pad successfully', async () => {
      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const res = await app.inject(payloadCreate);

      const { createGroupIfNotExistsFor, createGroupPad } = await reqsParams;
      expect(createGroupPad?.get('groupID')).toEqual(MOCK_GROUP_ID);
      // groupMapper sent to etherpad is equal to the generated padID
      expect(createGroupIfNotExistsFor?.get('groupMapper')).toEqual(createGroupPad?.get('padName'));

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toMatchObject({
        name: 'test-item-name',
        extra: {
          etherpad: {
            padID: `${MOCK_GROUP_ID}$${createGroupPad?.get('padName')}`,
            groupID: MOCK_GROUP_ID,
          },
        },
      });
    });

    it('returns error on etherpad HTTP error', async () => {
      setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.GATEWAY_TIMEOUT],
      });
      const res = await app.inject(payloadCreate);

      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject({
        code: 'GPEPERR001',
        message: 'Internal Etherpad server error',
        origin: 'graasp-plugin-etherpad',
      });
    });

    it.each(['pad does already exist', 'groupID does not exist'])(
      'returns error on etherpad server error: %p',
      async (error) => {
        setUpApi({
          createGroupIfNotExistsFor: [
            StatusCodes.OK,
            { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
          ],
          createGroupPad: [StatusCodes.OK, { code: 1, message: error, data: null }],
        });
        const res = await app.inject(payloadCreate);

        expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(res.json()).toMatchObject({
          code: 'GPEPERR001',
          message: 'Internal Etherpad server error',
          origin: 'graasp-plugin-etherpad',
        });
      },
    );

    it('deletes pad on item creation error', async () => {
      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
        deletePad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });

      // override item creation: ensure that it fails
      jest.spyOn(app.items.service, 'post').mockImplementationOnce(() => {
        throw new Error('mock error');
      });
      const res = await app.inject(payloadCreate);

      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toEqual({
        error: 'Internal Server Error',
        message: 'mock error',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });

      const { createGroupPad, deletePad } = await reqsParams;
      expect(deletePad?.get('padID')).toEqual(`${MOCK_GROUP_ID}$${createGroupPad?.get('padName')}`);
    });
  });

  describe('view a pad', () => {
    let item: EtherpadItemType;

    const payloadView = (mode: 'read' | 'write', itemId: string) => ({
      method: HttpMethod.Get,
      url: `items/etherpad/view/${itemId}`,
      query: {
        mode,
      },
    });

    beforeEach(async () => {
      // create an existing etherpad item to test reading it
      setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const res = await app.inject(payloadCreate);
      expect(res.statusCode).toBe(StatusCodes.OK);
      item = res.json();
      nock.cleanAll();
    });

    it('views a pad in read mode successfully', async () => {
      const reqParams = setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
        createAuthorIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { authorID: MOCK_AUTHOR_ID } },
        ],
        createSession: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { sessionID: MOCK_SESSION_ID } },
        ],
        listSessionsOfAuthor: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const res = await app.inject(payloadView('read', item.id));

      const { getReadOnlyID } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(item.extra.etherpad.padID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_PUBLIC_URL}/p/${MOCK_PAD_READ_ONLY_ID}`,
      });
    });

    it('views a pad in write mode successfully', async () => {
      const reqParams = setUpApi({
        createAuthorIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { authorID: MOCK_AUTHOR_ID } },
        ],
        createSession: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { sessionID: MOCK_SESSION_ID } },
        ],
        listSessionsOfAuthor: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });

      const res = await app.inject(payloadView('write', item.id));

      const { createAuthorIfNotExistsFor, createSession } = await reqParams;
      expect(createAuthorIfNotExistsFor?.get('authorMapper')).toEqual(member?.id);
      expect(createAuthorIfNotExistsFor?.get('name')).toEqual(member?.name);
      expect(createSession?.get('groupID')).toEqual(MOCK_GROUP_ID);
      expect(createSession?.get('authorID')).toEqual(MOCK_AUTHOR_ID);
      expect(createSession?.get('validUntil')).toBeDefined();
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_PUBLIC_URL}/p/${item.extra.etherpad.padID}`,
      });

      expect(res.cookies.length).toEqual(2);
      expect(res.cookies[1].name).toEqual('session');
      const { name, value, domain, path, expires } = res.cookies[0] as {
        name: string;
        value: string;
        domain: string;
        path: string;
        expires: Date;
      };
      expect(name).toEqual('sessionID');
      expect(value).toEqual(MOCK_SESSION_ID);
      expect(domain).toEqual('localhost');
      expect(path).toEqual('/');
      const expiration = DateTime.fromJSDate(expires);
      // since we don't know the exact time the server created the cookie, verify against a range
      expect(expiration > DateTime.now().plus({ days: 1 }).minus({ minutes: 1 })).toBeTruthy();
      expect(expiration < DateTime.now().plus({ days: 1 }).plus({ minutes: 1 })).toBeTruthy();
    });

    it('views a pad in write mode returns a read-only pad ID if user has read permission only', async () => {
      const bob = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({
        member: bob,
        item: {
          name: "bob's test etherpad item",
          type: ItemType.ETHERPAD,
          extra: EtherpadItemService.buildEtherpadExtra({
            groupID: MOCK_GROUP_ID,
            padName: MOCK_PAD_NAME,
          }),
        },
      });
      await testUtils.saveMembership({ item, member, permission: PermissionLevel.Read });
      const reqParams = setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
        createAuthorIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { authorID: MOCK_AUTHOR_ID } },
        ],
        createSession: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { sessionID: MOCK_SESSION_ID } },
        ],
        listSessionsOfAuthor: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const res = await app.inject(payloadView('write', item.id)); // <- we request write mode and should get a read ID

      const { getReadOnlyID } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(MOCK_PAD_ID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_PUBLIC_URL}/p/${MOCK_PAD_READ_ONLY_ID}`,
      });
    });

    it('concatenates existing sessions in cookie', async () => {
      const reqParams = setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
        createAuthorIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { authorID: MOCK_AUTHOR_ID } },
        ],
        createSession: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { sessionID: MOCK_SESSION_ID } },
        ],
        listSessionsOfAuthor: [
          StatusCodes.OK,
          {
            code: 0,
            message: 'ok',
            data: {
              [MOCK_SESSION_ID]: {
                groupID: MOCK_GROUP_ID,
                authorID: MOCK_AUTHOR_ID,
                validUntil: DateTime.now().plus({ days: 1 }).toUnixInteger(),
              },
              ['s.0000000000000000']: {
                groupID: MOCK_GROUP_ID,
                authorID: MOCK_AUTHOR_ID,
                validUntil: DateTime.now().plus({ days: 1 }).toUnixInteger(),
              },
            },
          },
        ],
      });

      const res = await app.inject(payloadView('read', item.id));

      const { getReadOnlyID } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(item.extra.etherpad.padID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_PUBLIC_URL}/p/${MOCK_PAD_READ_ONLY_ID}`,
      });

      expect(res.cookies.length).toEqual(2);
      expect(res.cookies[1].name).toEqual('session');
      const { name, value, domain, path, expires } = res.cookies[0] as {
        name: string;
        value: string;
        domain: string;
        path: string;
        expires: Date;
      };
      expect(name).toEqual('sessionID');
      const sessions = value.split(',');
      expect(sessions.length).toEqual(2);
      expect(sessions.includes(MOCK_SESSION_ID)).toBeTruthy();
      expect(sessions.includes('s.0000000000000000')).toBeTruthy();
      expect(domain).toEqual('localhost');
      expect(path).toEqual('/');
      const expiration = DateTime.fromJSDate(expires);
      // since we don't know the exact time the server created the cookie, verify against a range
      expect(expiration > DateTime.now().plus({ days: 1 }).minus({ minutes: 1 })).toBeTruthy();
      expect(expiration < DateTime.now().plus({ days: 1 }).plus({ minutes: 1 })).toBeTruthy();
    });

    it('deletes expired sessions', async () => {
      const reqParams = setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
        createAuthorIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { authorID: MOCK_AUTHOR_ID } },
        ],
        createSession: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { sessionID: MOCK_SESSION_ID } },
        ],
        listSessionsOfAuthor: [
          StatusCodes.OK,
          {
            code: 0,
            message: 'ok',
            data: {
              [MOCK_SESSION_ID]: {
                groupID: MOCK_GROUP_ID,
                authorID: MOCK_AUTHOR_ID,
                validUntil: DateTime.now().minus({ days: 1 }).toUnixInteger(),
              },
            },
          },
        ],
        deleteSession: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });

      const res = await app.inject(payloadView('read', item.id));

      const { getReadOnlyID, deleteSession } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(item.extra.etherpad.padID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_PUBLIC_URL}/p/${MOCK_PAD_READ_ONLY_ID}`,
      });

      expect(res.cookies.length).toEqual(2);
      expect(res.cookies[1].name).toEqual('session');
      const { name, value, domain, path, expires } = res.cookies[0] as {
        name: string;
        value: string;
        domain: string;
        path: string;
        expires: Date;
      };
      expect(name).toEqual('sessionID');
      expect(value).toEqual(MOCK_SESSION_ID);
      expect(domain).toEqual('localhost');
      expect(path).toEqual('/');
      const expiration = DateTime.fromJSDate(expires);
      // since we don't know the exact time the server created the cookie, verify against a range
      expect(expiration > DateTime.now().plus({ days: 1 }).minus({ minutes: 1 })).toBeTruthy();
      expect(expiration < DateTime.now().plus({ days: 1 }).plus({ minutes: 1 })).toBeTruthy();

      expect(deleteSession?.get('sessionID')).toEqual(MOCK_SESSION_ID);
    });

    it('invalidates oldest sessions if the number of sessions exceeds MAX_SESSIONS_IN_COOKIES', async () => {
      const reqParams = setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
        createAuthorIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { authorID: MOCK_AUTHOR_ID } },
        ],
        createSession: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { sessionID: MOCK_SESSION_ID } },
        ],
        listSessionsOfAuthor: [
          StatusCodes.OK,
          {
            code: 0,
            message: 'ok',
            data: {
              ...Object.fromEntries(
                Array.from({ length: MAX_SESSIONS_IN_COOKIE }, (_, i) => [
                  `s.${i.toString().padStart(16, '0')}`,
                  {
                    groupID: `g.${i.toString().padStart(16, '0')}`,
                    authorID: MOCK_AUTHOR_ID,
                    validUntil: DateTime.now().plus({ seconds: i }).toUnixInteger(),
                  },
                ]),
              ),
              // this emulates the newly created session
              [MOCK_SESSION_ID]: {
                groupID: MOCK_GROUP_ID,
                authorID: MOCK_AUTHOR_ID,
                validUntil: DateTime.now().plus({ days: 1 }).toUnixInteger(),
              },
            },
          },
        ],
        deleteSession: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });

      const res = await app.inject(payloadView('read', item.id));

      const { getReadOnlyID, deleteSession } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(item.extra.etherpad.padID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_PUBLIC_URL}/p/${MOCK_PAD_READ_ONLY_ID}`,
      });

      expect(res.cookies.length).toEqual(2);
      expect(res.cookies[1].name).toEqual('session');
      const { name, value, domain, path, expires } = res.cookies[0] as {
        name: string;
        value: string;
        domain: string;
        path: string;
        expires: Date;
      };
      expect(name).toEqual('sessionID');
      const sessions = value.split(',');
      expect([MAX_SESSIONS_IN_COOKIE, MAX_SESSIONS_IN_COOKIE - 1]).toContain(sessions.length);
      // the first (oldest) session should not be in the cookie
      Array.from(
        { length: MAX_SESSIONS_IN_COOKIE - 1 },
        (_, i) => `s.${(i + 1).toString().padStart(16, '0')}`,
      ).forEach((s) => expect(sessions.includes(s)));
      expect(sessions.includes(MOCK_SESSION_ID)).toBeTruthy();
      expect(sessions.includes('s.0000000000000000')).toBeFalsy();
      expect(domain).toEqual('localhost');
      expect(path).toEqual('/');
      const expiration = DateTime.fromJSDate(expires);
      // since we don't know the exact time the server created the cookie, verify against a range
      expect(expiration > DateTime.now().plus({ days: 1 }).minus({ minutes: 1 })).toBeTruthy();
      expect(expiration < DateTime.now().plus({ days: 1 }).plus({ minutes: 1 })).toBeTruthy();
      // the first (oldest) session should be invalidated
      expect(deleteSession?.get('sessionID')).toEqual('s.0000000000000000');
    });

    /**
     * This is a regression test based on a real case in the production DB
     */
    it('handles malformed sessions in database', async () => {
      const reqParams = setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
        createAuthorIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { authorID: MOCK_AUTHOR_ID } },
        ],
        createSession: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { sessionID: MOCK_SESSION_ID } },
        ],
        listSessionsOfAuthor: [
          StatusCodes.OK,
          {
            code: 0,
            message: 'ok',
            data: {
              // the server may return null as mapping
              's.0000000000000000': null,
            },
          },
        ],
        deleteSession: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });

      const res = await app.inject(payloadView('read', item.id));

      const { getReadOnlyID, deleteSession } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(item.extra.etherpad.padID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_PUBLIC_URL}/p/${MOCK_PAD_READ_ONLY_ID}`,
      });

      expect(res.cookies.length).toEqual(2);
      expect(res.cookies[1].name).toEqual('session');
      const { name, value, domain, path, expires } = res.cookies[0] as {
        name: string;
        value: string;
        domain: string;
        path: string;
        expires: Date;
      };
      expect(name).toEqual('sessionID');
      expect(value).toEqual(MOCK_SESSION_ID);
      expect(domain).toEqual('localhost');
      expect(path).toEqual('/');
      const expiration = DateTime.fromJSDate(expires);
      // since we don't know the exact time the server created the cookie, verify against a range
      expect(expiration > DateTime.now().plus({ days: 1 }).minus({ minutes: 1 })).toBeTruthy();
      expect(expiration < DateTime.now().plus({ days: 1 }).plus({ minutes: 1 })).toBeTruthy();

      // check that the malformed session is deleted
      expect(deleteSession?.get('sessionID')).toEqual('s.0000000000000000');
    });

    it.each(MODES)('returns error if item is not found (%p)', async (mode) => {
      setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
      });

      // generate an id for an item that does not exist
      let randomId;
      do {
        randomId = v4();
        // probability if infinitely low, but just for sanity
      } while (randomId === item.id);
      const res = await app.inject(payloadView(mode, randomId));

      expect(res.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(res.json()).toEqual(new ItemNotFound(randomId));
    });

    it.each(MODES)('returns error if item is missing etherpad extra (%p)', async (mode) => {
      setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
      });

      const { item: bogusItem } = await testUtils.saveItemAndMembership({ member });

      const res = await app.inject(payloadView(mode, bogusItem.id));

      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject(new ItemMissingExtraError(bogusItem.id));
    });

    it.each(MODES)('returns error if member does not have %p permission', async (mode) => {
      const bob = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({
        member: bob,
        item: {
          name: "bob's test etherpad item",
          extra: EtherpadItemService.buildEtherpadExtra({
            groupID: MOCK_GROUP_ID,
            padName: MOCK_PAD_NAME,
          }),
        },
      });

      setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
      });

      const res = await app.inject(payloadView(mode, item.id));

      expect(res.statusCode).toEqual(StatusCodes.FORBIDDEN);
      expect(res.json()).toMatchObject(new MemberCannotAccess(item.id));
    });

    it('returns error on etherpad HTTP error', async () => {
      setUpApi({
        getReadOnlyID: [StatusCodes.GATEWAY_TIMEOUT],
      });
      const res = await app.inject(payloadView('read', item.id));
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject({
        code: 'GPEPERR001',
        message: 'Internal Etherpad server error',
        origin: 'graasp-plugin-etherpad',
      });
    });

    it('returns error on etherpad server error: "padID does not exist"', async () => {
      setUpApi({
        getReadOnlyID: [StatusCodes.OK, { code: 1, message: 'padID does not exist', data: null }],
      });
      const res = await app.inject(payloadView('read', item.id));
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject({
        code: 'GPEPERR001',
        message: 'Internal Etherpad server error',
        origin: 'graasp-plugin-etherpad',
      });
    });

    it.each(["groupID doesn't exist", "authorID doesn't exist", 'validUntil is in the past'])(
      'returns error on etherpad server error: %p',
      async (error) => {
        setUpApi({
          createAuthorIfNotExistsFor: [
            StatusCodes.OK,
            { code: 0, message: 'ok', data: { authorID: MOCK_AUTHOR_ID } },
          ],
          createSession: [StatusCodes.OK, { code: 1, message: error, data: null }],
        });
        const res = await app.inject(payloadView('write', item.id));
        expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(res.json()).toMatchObject({
          code: 'GPEPERR001',
          message: 'Internal Etherpad server error',
          origin: 'graasp-plugin-etherpad',
        });
      },
    );
  });

  describe('hook handlers', () => {
    let item: EtherpadItemType;

    beforeEach(async () => {
      // create an existing etherpad item to test hooks
      setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const res = await app.inject(payloadCreate);
      expect(res.statusCode).toBe(StatusCodes.OK);
      item = res.json();
      nock.cleanAll();
    });

    it('deletes pad when item is deleted', async () => {
      const reqsParams = setUpApi({
        deletePad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      await app.inject({
        method: 'DELETE',
        url: `/items/`,
        query: {
          id: [item.id],
        },
      });
      const { deletePad } = await reqsParams;
      expect(deletePad?.get('padID')).toEqual(item.extra.etherpad.padID);
    });

    it('copies pad when item is copied', async () => {
      const parent = await testUtils.saveItemAndMembership({
        member,
        item: { name: 'test parent' },
      });

      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        copyPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });

      await app.inject({
        method: 'POST',
        url: 'items/copy',
        query: {
          id: [item.id],
        },
        payload: {
          parentId: parent.item.id,
        },
      });

      // wait until the copy is in the db
      await waitForExpect(async () => {
        expect(await testUtils.rawItemRepository.count()).toEqual(3);
      });

      const copy = (await testUtils.rawItemRepository.findOneBy({
        id: And(Not(item.id), Not(parent.item.id)),
      })) as Item<typeof ItemType.ETHERPAD>;
      expect(copy).not.toBeNull();

      const { createGroupIfNotExistsFor, copyPad } = await reqsParams;
      expect(copyPad?.get('destinationID')).toEqual(
        `${copy.extra.etherpad.groupID}$${createGroupIfNotExistsFor?.get('groupMapper')}`,
      );
      expect(copyPad?.get('sourceID')).toEqual(item.extra.etherpad.padID);
      // verify that the handler mutated the item on its extra (should have created a newly copied pad)
      expect(item.extra).not.toEqual(copy.extra);
    });

    it('throws if pad ID is not defined on copy', async () => {
      const { item: parent } = await testUtils.saveItemAndMembership({ member });
      const { item: bogusItem } = await testUtils.saveItemAndMembership({ member });

      setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        copyPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });

      const res = await app.inject({
        method: 'POST',
        url: 'items/copy',
        query: {
          id: [bogusItem.id],
        },
        payload: {
          parentId: parent.id,
        },
      });

      expect(res.statusCode).not.toEqual(StatusCodes.OK);
    });
  });
});
