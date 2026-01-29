import { faker } from '@faker-js/faker';
import { add, isAfter, isBefore, sub } from 'date-fns';
import { StatusCodes } from 'http-status-codes';
import { cleanAll } from 'nock';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { EtherpadPermission, HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { isDirectChild } from '../../../../drizzle/operations';
import { itemsRawTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { ETHERPAD_PUBLIC_URL } from '../../../../utils/config';
import { ItemNotFound, MemberCannotAccess } from '../../../../utils/errors';
import type { EtherpadItem } from '../../discrimination';
import { ItemService } from '../../item.service';
import { MAX_SESSIONS_IN_COOKIE } from './constants';
import { ItemMissingExtraError } from './errors';
import { EtherpadItemService } from './etherpad.service';
import { setUpApi } from './test/api';

const MOCK_GROUP_ID = 'g.s8oes9dhwrvt0zif';
const MOCK_PAD_READ_ONLY_ID = 'r.s8oes9dhwrvt0zif';
const MOCK_PAD_NAME = 'mock-pad-name';
const MOCK_PAD_ID = `${MOCK_GROUP_ID}\$${MOCK_PAD_NAME}`;
const MOCK_AUTHOR_ID = 'a.s8oes9dhwrvt0zif';
const MOCK_SESSION_ID = 's.s8oes9dhwrvt0zif';
const MODES: Array<'read' | 'write'> = ['read', 'write'];

const expectExpiration = (expires: Date) => {
  const oneDayFromNow = add(new Date(), { days: 1 });
  // since we don't know the exact time the server created the cookie, verify against a range
  expect(isAfter(expires, sub(oneDayFromNow, { minutes: 1 }))).toBeTruthy();
  expect(isBefore(expires, add(oneDayFromNow, { minutes: 1 }))).toBeTruthy();
};

const createEtherpad = async (app, parentId?: string) => {
  // create an existing etherpad item to test reading it
  setUpApi({
    createGroupIfNotExistsFor: [
      StatusCodes.OK,
      { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
    ],
    createGroupPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
  });
  const res = await app.inject({
    method: HttpMethod.Post,
    url: '/api/items/etherpad/create',
    payload: {
      name: faker.word.sample(),
    },
    query: parentId ? { parentId } : undefined,
  });
  expect(res.statusCode).toBe(StatusCodes.OK);
  const item = res.json();
  cleanAll();
  return item;
};

describe('Etherpad service API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
    cleanAll();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    unmockAuthenticate();
  });

  describe('create a pad', () => {
    it('creates a pad successfully', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const payload = {
        name: faker.word.sample(),
      };
      const res = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/etherpad/create',
        payload,
      });

      const { createGroupIfNotExistsFor, createGroupPad } = await reqsParams;
      expect(createGroupPad?.get('groupID')).toEqual(MOCK_GROUP_ID);
      // groupMapper sent to etherpad is equal to the generated padID
      expect(createGroupIfNotExistsFor?.get('groupMapper')).toEqual(createGroupPad?.get('padName'));

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toMatchObject({
        name: payload.name,
        extra: {
          etherpad: {
            padID: `${MOCK_GROUP_ID}$${createGroupPad?.get('padName')}`,
            groupID: MOCK_GROUP_ID,
          },
        },
      });
    });

    it('creates a pad with reader permission = write', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const name = faker.word.sample();
      const res = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/etherpad/create',
        payload: {
          name,
          readerPermission: EtherpadPermission.Write,
        },
      });

      const { createGroupIfNotExistsFor, createGroupPad } = await reqsParams;
      expect(createGroupPad?.get('groupID')).toEqual(MOCK_GROUP_ID);
      // groupMapper sent to etherpad is equal to the generated padID
      expect(createGroupIfNotExistsFor?.get('groupMapper')).toEqual(createGroupPad?.get('padName'));

      expect(res.statusCode).toEqual(StatusCodes.OK);
      expect(res.json()).toMatchObject({
        name,
        extra: {
          etherpad: {
            padID: `${MOCK_GROUP_ID}$${createGroupPad?.get('padName')}`,
            groupID: MOCK_GROUP_ID,
            readerPermission: EtherpadPermission.Write,
          },
        },
      });
    });

    it('returns error on etherpad HTTP error', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.GATEWAY_TIMEOUT],
      });
      const res = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/etherpad/create',
        payload: {
          name: faker.word.sample(),
        },
      });

      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject({
        code: 'GPEPERR001',
        message: 'Internal Etherpad server error',
        origin: 'graasp-plugin-etherpad',
      });
    });

    it.each([
      'pad does already exist',
      // 'groupID does not exist'
    ])('returns error on etherpad server error: %p', async (error) => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.OK, { code: 1, message: error, data: null }],
      });
      const res = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/etherpad/create',
        payload: {
          name: faker.word.sample(),
        },
      });

      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject({
        code: 'GPEPERR001',
        message: 'Internal Etherpad server error',
        origin: 'graasp-plugin-etherpad',
      });
    });

    it('deletes pad on item creation error', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
        deletePad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });

      // override item creation: ensure that it fails
      const originalFn = ItemService.prototype.post;
      jest.spyOn(ItemService.prototype, 'post').mockImplementation(() => {
        throw new Error('mock error');
      });
      const res = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/etherpad/create',
        payload: {
          name: faker.word.sample(),
        },
      });
      // bug: for some reason we need to set back the original implement manually
      ItemService.prototype.post = originalFn;

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
    const payloadView = (mode: 'read' | 'write', itemId: string) => ({
      method: HttpMethod.Get,
      url: `/api/items/etherpad/view/${itemId}`,
      query: {
        mode,
      },
    });
    it('member views a pad in read mode successfully', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const item = await createEtherpad(app);

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
    it('guest views a pad in read mode successfully', async () => {
      const {
        actor,
        guests: [guest],
        items: [parentItem],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ permission: 'write', account: 'actor' }],
            type: 'folder',
            itemLoginSchema: { guests: [{}] },
          },
        ],
      });
      assertIsDefined(guest);
      assertIsDefined(actor);
      // authenticate as actor
      mockAuthenticate(actor);

      const item = await createEtherpad(app, parentItem.id);

      // switch to guest authentication
      mockAuthenticate(guest);

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
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const item = await createEtherpad(app);

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
      expect(createAuthorIfNotExistsFor?.get('authorMapper')).toEqual(actor?.id);
      expect(createAuthorIfNotExistsFor?.get('name')).toEqual(actor?.name);
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
      expectExpiration(expires);
    });
    it('views a pad in write mode returns a read-only pad ID if user has read permission only', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            name: "bob's test etherpad item",
            type: 'etherpad',
            extra: EtherpadItemService.buildEtherpadExtra({
              groupID: MOCK_GROUP_ID,
              padName: MOCK_PAD_NAME,
            }),
            memberships: [{ account: 'actor', permission: 'read' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

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
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            name: "bob's test etherpad item",
            type: 'etherpad',
            extra: EtherpadItemService.buildEtherpadExtra({
              groupID: MOCK_GROUP_ID,
              padName: MOCK_PAD_NAME,
            }),
            memberships: [{ account: 'actor', permission: 'read' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

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
                validUntil: add(new Date(), { days: 1 }).getTime() / 1000,
              },
              ['s.0000000000000000']: {
                groupID: MOCK_GROUP_ID,
                authorID: MOCK_AUTHOR_ID,
                validUntil: add(new Date(), { days: 1 }).getTime() / 1000,
              },
            },
          },
        ],
      });
      const res = await app.inject(payloadView('read', item.id));
      const { getReadOnlyID } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual((item as EtherpadItem).extra.etherpad.padID);
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
      expectExpiration(expires);
    });
    it('deletes expired sessions', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            name: "bob's test etherpad item",
            type: 'etherpad',
            extra: EtherpadItemService.buildEtherpadExtra({
              groupID: MOCK_GROUP_ID,
              padName: MOCK_PAD_NAME,
            }),
            memberships: [{ account: 'actor', permission: 'read' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

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
                validUntil: sub(new Date(), { days: 1 }).getTime() / 1000,
              },
            },
          },
        ],
        deleteSession: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const res = await app.inject(payloadView('read', item.id));
      const { getReadOnlyID, deleteSession } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual((item as EtherpadItem).extra.etherpad.padID);
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
      expectExpiration(expires);
      expect(deleteSession?.get('sessionID')).toEqual(MOCK_SESSION_ID);
    });
    it('invalidates oldest sessions if the number of sessions exceeds MAX_SESSIONS_IN_COOKIES', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            name: "bob's test etherpad item",
            type: 'etherpad',
            extra: EtherpadItemService.buildEtherpadExtra({
              groupID: MOCK_GROUP_ID,
              padName: MOCK_PAD_NAME,
            }),
            memberships: [{ account: 'actor', permission: 'read' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

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
                    validUntil: add(new Date(), { seconds: i }).getTime() / 1000,
                  },
                ]),
              ),
              // this emulates the newly created session
              [MOCK_SESSION_ID]: {
                groupID: MOCK_GROUP_ID,
                authorID: MOCK_AUTHOR_ID,
                validUntil: add(new Date(), { days: 1 }).getTime() / 1000,
              },
            },
          },
        ],
        deleteSession: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const res = await app.inject(payloadView('read', item.id));
      const { getReadOnlyID, deleteSession } = await reqParams;
      expect(getReadOnlyID?.get('padID')).toEqual((item as EtherpadItem).extra.etherpad.padID);
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
      expectExpiration(expires);
      // the first (oldest) session should be invalidated
      expect(deleteSession?.get('sessionID')).toEqual('s.0000000000000000');
    });
    /**
     * This is a regression test based on a real case in the production DB
     */
    it('handles malformed sessions in database', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            name: "bob's test etherpad item",
            type: 'etherpad',
            extra: EtherpadItemService.buildEtherpadExtra({
              groupID: MOCK_GROUP_ID,
              padName: MOCK_PAD_NAME,
            }),
            memberships: [{ account: 'actor', permission: 'read' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

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
      expect(getReadOnlyID?.get('padID')).toEqual((item as EtherpadItem).extra.etherpad.padID);
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
      expectExpiration(expires);
      // check that the malformed session is deleted
      expect(deleteSession?.get('sessionID')).toEqual('s.0000000000000000');
    });
    it.each(MODES)('returns error if item is not found (%p)', async (mode) => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
      });
      // generate an id for an item that does not exist
      const randomId = v4();
      const res = await app.inject(payloadView(mode, randomId));
      expect(res.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(res.json().message).toEqual(new ItemNotFound(randomId).message);
    });
    it.each(MODES)('returns error if item is missing etherpad extra (%p)', async (mode) => {
      const {
        actor,
        items: [bogusItem],
      } = await seedFromJson({
        items: [
          {
            name: "bob's test etherpad item",
            type: 'etherpad',
            memberships: [{ account: 'actor', permission: 'read' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      setUpApi({
        getReadOnlyID: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { readOnlyID: MOCK_PAD_READ_ONLY_ID } },
        ],
      });
      const res = await app.inject(payloadView(mode, bogusItem.id));
      expect(res.statusCode).toEqual(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.json()).toMatchObject(new ItemMissingExtraError(bogusItem.id));
    });
    it.each(MODES)('returns error if member does not have %p permission', async (mode) => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            name: "bob's test etherpad item",
            type: 'etherpad',
            extra: EtherpadItemService.buildEtherpadExtra({
              groupID: MOCK_GROUP_ID,
              padName: MOCK_PAD_NAME,
            }),
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

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
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            name: "bob's test etherpad item",
            type: 'etherpad',
            extra: EtherpadItemService.buildEtherpadExtra({
              groupID: MOCK_GROUP_ID,
              padName: MOCK_PAD_NAME,
            }),
            memberships: [{ account: 'actor', permission: 'read' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

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
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            name: "bob's test etherpad item",
            type: 'etherpad',
            extra: EtherpadItemService.buildEtherpadExtra({
              groupID: MOCK_GROUP_ID,
              padName: MOCK_PAD_NAME,
            }),
            memberships: [{ account: 'actor', permission: 'read' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

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
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              name: "bob's test etherpad item",
              type: 'etherpad',
              extra: EtherpadItemService.buildEtherpadExtra({
                groupID: MOCK_GROUP_ID,
                padName: MOCK_PAD_NAME,
              }),
              memberships: [{ account: 'actor', permission: 'read' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

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
    it('deletes pad when item is deleted', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const item = await createEtherpad(app);

      const reqsParams = setUpApi({
        deletePad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      await app.inject({
        method: 'DELETE',
        url: `/api/items`,
        query: {
          id: [item.id],
        },
      });
      const { deletePad } = await reqsParams;
      expect(deletePad?.get('padID')).toEqual(item.extra.etherpad.padID);
    });
    it('copies pad when item is copied', async () => {
      const {
        actor,
        items: [parent],
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      const item = await createEtherpad(app);

      const reqsParams = setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        copyPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      await app.inject({
        method: 'POST',
        url: '/api/items/copy',
        query: {
          id: [item.id],
        },
        payload: {
          parentId: parent.id,
        },
      });
      // wait until the copy is in the parent
      let copy;
      await waitForExpect(async () => {
        copy = await db.query.itemsRawTable.findFirst({
          where: isDirectChild(itemsRawTable.path, parent.path),
        });
        expect(copy).toBeDefined();
      });
      const { createGroupIfNotExistsFor, copyPad } = await reqsParams;
      expect(copyPad?.get('destinationID')).toEqual(
        `${copy.extra.etherpad.groupID}$${createGroupIfNotExistsFor?.get('groupMapper')}`,
      );
      expect(copyPad?.get('sourceID')).toEqual(item.extra.etherpad.padID);
      // verify that the handler mutated the item on its extra (should have created a newly copied pad)
      expect(item.extra).not.toEqual(copy.extra);
    });
    it('throws if pad ID is not defined on copy', async () => {
      const {
        actor,
        items: [parent, bogusItem],
      } = await seedFromJson({
        items: [
          { memberships: [{ account: 'actor', permission: 'admin' }] },
          { memberships: [{ account: 'actor', permission: 'admin' }] },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        copyPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/items/copy',
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
  describe('update a pad', () => {
    it('update a pad should return no content', async () => {
      setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            type: 'etherpad',
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      const res = await app.inject({
        method: HttpMethod.Patch,
        url: `/api/items/etherpad/${item.id}`,
        payload: {
          name: 'new-name',
        },
      });
      expect(res.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });
    it('update a pad with reader permission = write should return no content', async () => {
      setUpApi({
        createGroupIfNotExistsFor: [
          StatusCodes.OK,
          { code: 0, message: 'ok', data: { groupID: MOCK_GROUP_ID } },
        ],
        createGroupPad: [StatusCodes.OK, { code: 0, message: 'ok', data: null }],
      });
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            type: 'etherpad',
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);
      const res = await app.inject({
        method: HttpMethod.Patch,
        url: `/api/items/etherpad/${item.id}`,
        payload: {
          name: 'new-name',
          readerPermission: EtherpadPermission.Write,
        },
      });
      expect(res.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });
    it('update a pad without payload should throw', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      mockAuthenticate(actor);
      const res = await app.inject({
        method: HttpMethod.Patch,
        url: `/api/items/etherpad/${v4()}`,
      });
      expect(res.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });
});
