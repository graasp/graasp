/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from '@faker-js/faker';
import { eq } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { ClientManager, Context, HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { actionsTable } from '../../../../drizzle/schema';
import type { ItemRaw } from '../../../../drizzle/types';
import { MailerService } from '../../../../plugins/mailer/mailer.service';
import { assertIsDefined } from '../../../../utils/assertions';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { CannotPostAction } from './errors';

// note: some tests are flacky
jest.retryTimes(3, { logErrorsBeforeRetry: true });

const BUILDER_HOST = ClientManager.getInstance().getURLByContext(Context.Builder);

const uploadDoneMock = jest.fn(async () => console.debug('aws s3 storage upload'));
const deleteObjectMock = jest.fn(async () => console.debug('deleteObjectMock'));
const headObjectMock = jest.fn(async () => console.debug('headObjectMock'));
const MOCK_SIGNED_URL = 'signed-url';
jest.mock('@aws-sdk/client-s3', () => {
  return {
    GetObjectCommand: jest.fn(),
    S3: function () {
      return {
        deleteObject: deleteObjectMock,
        putObject: uploadDoneMock,
        headObject: headObjectMock,
      };
    },
  };
});
jest.mock('@aws-sdk/s3-request-presigner', () => {
  const getSignedUrl = jest.fn(async () => MOCK_SIGNED_URL);
  return {
    getSignedUrl,
  };
});
jest.mock('@aws-sdk/lib-storage', () => {
  return {
    Upload: jest.fn().mockImplementation(() => {
      return {
        done: uploadDoneMock,
      };
    }),
  };
});

const getActionsByItemId = async (itemId: ItemRaw['id']) => {
  return await db.query.actionsTable.findMany({
    where: eq(actionsTable.itemId, itemId),
  });
};

describe('Action Plugin Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('POST /:id/actions', () => {
    describe('Public', () => {
      it('Post action for public item', async () => {
        const {
          items: [item],
        } = await seedFromJson({ actor: null, items: [{ isPublic: true }] });

        const body = {
          type: faker.word.sample(),
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body,
          headers: {
            Origin: BUILDER_HOST.origin,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        const actions = await getActionsByItemId(item.id);
        expect(actions).toHaveLength(1);
        expect(actions[0].itemId).toEqual(item.id);
        expect(actions[0].accountId).toBeNull();
      });
    });
    describe('Signed in', () => {
      it('Post action with allowed origin', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: 'read' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const body = {
          type: faker.word.sample(),
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body,
          headers: {
            Origin: BUILDER_HOST.origin,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        const actions = await getActionsByItemId(item.id);
        expect(actions).toHaveLength(1);
        expect(actions[0].itemId).toEqual(item.id);
        expect(actions[0].accountId).toEqual(actor.id);
      });
      it('Post action with extra', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: 'read' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const body = {
          type: faker.word.sample(),
          extra: { foo: faker.word.sample() },
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body,
          headers: {
            Origin: BUILDER_HOST.origin,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        const actions = await getActionsByItemId(item.id);
        expect(actions).toHaveLength(1);
        expect(actions[0].itemId).toEqual(item.id);
        expect(actions[0].accountId).toEqual(actor.id);
      });
      it('Throw for non-allowed origin', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: 'read' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const body = {
          type: faker.word.sample(),
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body,
          headers: {
            Origin: 'https://myorigin.com',
          },
        });
        expect(response.json().message).toEqual(new CannotPostAction().message);
        const actions = await getActionsByItemId(item.id);
        expect(actions).toHaveLength(0);
      });
      it('Throw for missing type', async () => {
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: 'read' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const body = {
          extra: { prop: faker.word.sample() },
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body,
          headers: {
            Origin: BUILDER_HOST.toString(),
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        const actions = await getActionsByItemId(item.id);
        expect(actions).toHaveLength(0);
      });
    });

    describe('Sign Out', () => {
      it('Cannot post action when signed out', async () => {
        const {
          items: [item],
        } = await seedFromJson({ actor: null, items: [{}] });

        const body = {
          type: faker.word.sample(),
        };
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions`,
          body,
          headers: {
            Origin: BUILDER_HOST.toString(),
          },
        });

        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
        expect(
          await db.query.actionsTable.findFirst({ where: eq(actionsTable.type, body.type) }),
        ).toBeUndefined();
      });
    });
  });

  describe('POST /:id/actions/export', () => {
    it('Create archive and send email', async () => {
      const mailerService = resolveDependency(MailerService);
      const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');
      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions/export`,
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        expect(uploadDoneMock).toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalled();
      });
    });

    it('Create archive for item with an app and send email', async () => {
      const mailerService = resolveDependency(MailerService);
      const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');

      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [
          {
            type: 'app',
            appData: [
              { account: 'actor', creator: 'actor' },
              { account: 'actor', creator: 'actor' },
            ],
            appSettings: [{ creator: 'actor' }, { creator: 'actor' }],
            appActions: [{ account: 'actor' }, { account: 'actor' }],
            memberships: [{ account: 'actor', permission: 'admin' }],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions/export`,
      });

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        expect(uploadDoneMock).toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalled();
      });
    });

    it('Create archive if last export is old and send email', async () => {
      const mailerService = resolveDependency(MailerService);
      const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');

      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [
          {
            type: 'app',
            appData: [
              { account: 'actor', creator: 'actor' },
              { account: 'actor', creator: 'actor' },
            ],
            appSettings: [{ creator: 'actor' }, { creator: 'actor' }],
            appActions: [{ account: 'actor' }, { account: 'actor' }],
            memberships: [{ account: 'actor', permission: 'admin' }],
            actionRequestExports: [
              {
                member: 'actor',
                createdAt: new Date('2021').toISOString(),
              },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions/export`,
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        expect(uploadDoneMock).toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalled();
      });
    });

    it('Does not create archive if last export is recent, but send email', async () => {
      const mailerService = resolveDependency(MailerService);
      const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');

      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: 'admin' }],
            actionRequestExports: [
              {
                member: 'actor',
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `${ITEMS_ROUTE_PREFIX}/${item.id}/actions/export`,
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

      await waitForExpect(() => {
        expect(uploadDoneMock).not.toHaveBeenCalled();
        expect(mockSendEmail).toHaveBeenCalled();
      });
    });
  });
});
