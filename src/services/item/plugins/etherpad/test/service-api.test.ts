import { StatusCodes } from 'http-status-codes';
import { DateTime } from 'luxon';
import nock from 'nock';

import { FastifyInstance } from 'fastify';

import { HttpMethod, Item } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app';
import { ETHERPAD_URL } from '../../../../../utils/config';
import { Member } from '../../../../member/entities/member';
import { MAX_SESSIONS_IN_COOKIE } from '../constants';
import { setUpApi } from './api';

// mock datasource
jest.mock('../../../../../plugins/datasource');

const MOCK_GROUP_ID = 'g.s8oes9dhwrvt0zif';
const MOCK_PAD_READ_ONLY_ID = 'r.s8oes9dhwrvt0zif';
const MOCK_PAD_ID = 'g.s8oes9dhwrvt0zif$mock-pad-name';
const MOCK_AUTHOR_ID = 'a.s8oes9dhwrvt0zif';
const MOCK_SESSION_ID = 's.s8oes9dhwrvt0zif';
const MODES: Array<'read' | 'write'> = ['read', 'write'];

describe('Service API', () => {
  let app: FastifyInstance;
  let member: Member | null;
  let parent: Item;

  beforeAll(async () => {
    ({ app, actor: member } = await build());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    nock.cleanAll();
  });

  afterAll(() => {
    app.close();
  });

  describe('create a pad', () => {
    const payloadCreate = {
      method: HttpMethod.POST,
      url: 'items/etherpad/create',
      payload: {
        name: 'test-item-name',
      },
    };

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
    const payloadView = (mode: 'read' | 'write') => ({
      method: HttpMethod.GET,
      url: '/etherpad/view/mock-item-id',
      query: {
        mode,
      },
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
      const res = await app.inject(payloadView('read'));

      const { getReadOnlyID } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(MOCK_PAD_ID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_URL}/p/${MOCK_PAD_READ_ONLY_ID}`,
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

      const res = await app.inject(payloadView('write'));

      const { createAuthorIfNotExistsFor, createSession } = await reqParams;
      expect(createAuthorIfNotExistsFor?.get('authorMapper')).toEqual(member?.id);
      expect(createAuthorIfNotExistsFor?.get('name')).toEqual(member?.name);
      expect(createSession?.get('groupID')).toEqual(MOCK_GROUP_ID);
      expect(createSession?.get('authorID')).toEqual(MOCK_AUTHOR_ID);
      expect(createSession?.get('validUntil')).toBeDefined();
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_URL}/p/${MOCK_GROUP_ID}$mock-pad-name`,
      });

      expect(res.cookies.length).toEqual(1);
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
      const res = await app.inject(payloadView('write')); // <- we request write mode and should get a read ID

      const { getReadOnlyID } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(MOCK_PAD_ID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_URL}/p/${MOCK_PAD_READ_ONLY_ID}`,
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

      const res = await app.inject(payloadView('read'));

      const { getReadOnlyID } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(MOCK_PAD_ID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_URL}/p/${MOCK_PAD_READ_ONLY_ID}`,
      });

      expect(res.cookies.length).toEqual(1);
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

      const res = await app.inject(payloadView('read'));

      const { getReadOnlyID, deleteSession } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(MOCK_PAD_ID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_URL}/p/${MOCK_PAD_READ_ONLY_ID}`,
      });

      expect(res.cookies.length).toEqual(1);
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

      const res = await app.inject(payloadView('read'));

      const { getReadOnlyID, deleteSession } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(MOCK_PAD_ID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_URL}/p/${MOCK_PAD_READ_ONLY_ID}`,
      });

      expect(res.cookies.length).toEqual(1);
      const { name, value, domain, path, expires } = res.cookies[0] as {
        name: string;
        value: string;
        domain: string;
        path: string;
        expires: Date;
      };
      expect(name).toEqual('sessionID');
      const sessions = value.split(',');
      expect(sessions.length).toEqual(MAX_SESSIONS_IN_COOKIE);
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
              // todo: fix types in etherpad-api
              // the server may return null as mapping
              's.0000000000000000': null,
            },
          },
        ],
        deleteSession: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });

      const res = await app.inject(payloadView('read'));

      const { getReadOnlyID, deleteSession } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual(MOCK_PAD_ID);
      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toEqual({
        padUrl: `${ETHERPAD_URL}/p/${MOCK_PAD_READ_ONLY_ID}`,
      });

      expect(res.cookies.length).toEqual(1);
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

      expect(deleteSession?.get('sessionID')).toEqual('s.0000000000000000');
    });

    it.each(MODES)('returns error if item is not found (%p)', async (mode) => {
      setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
      });

      const res = await app.inject(payloadView(mode));

      expect(res.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(res.json()).toEqual({
        code: 'GPEPERR002',
        message: 'Item not found',
        origin: 'graasp-plugin-etherpad',
        statusCode: StatusCodes.NOT_FOUND,
      });
    });

    it.each(MODES)('returns error if item is missing etherpad extra (%p)', async (mode) => {
      setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
      });

      const res = await app.inject(payloadView(mode));

      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toEqual({
        code: 'GPEPERR003',
        message: 'Item missing etherpad extra',
        origin: 'graasp-plugin-etherpad',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      });
    });

    it.each(MODES)('returns error if member does not have %p permission', async (mode) => {
      setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
      });

      const res = await app.inject(payloadView(mode));

      expect(res.statusCode).toEqual(StatusCodes.FORBIDDEN);
      expect(res.json()).toEqual({
        code: 'GPEPERR004',
        message: 'Access forbidden to this item',
        origin: 'graasp-plugin-etherpad',
        statusCode: StatusCodes.FORBIDDEN,
      });
    });

    it('returns error on etherpad HTTP error', async () => {
      setUpApi({
        getReadOnlyID: [StatusCodes.GATEWAY_TIMEOUT],
      });
      const res = await app.inject(payloadView('read'));
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
      const res = await app.inject(payloadView('read'));
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
        const res = await app.inject(payloadView('write'));
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
    it('deletes pad when item is deleted', async () => {
      const reqsParams = setUpApi({
        deletePad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
    });

    it('copies pad when item is copied', async () => {
      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        copyPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
    });

    it('throws if pad ID is not defined on copy', async () => {
      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        copyPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
    });
  });
});
