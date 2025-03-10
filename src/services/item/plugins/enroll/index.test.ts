import { StatusCodes } from 'http-status-codes';
import { v4 as uuid } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemLoginSchemaStatus, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { assertIsDefined } from '../../../../utils/assertions';
import {
  CannotEnrollFrozenItemLoginSchema,
  CannotEnrollItemWithoutItemLoginSchema,
} from '../../../itemLogin/errors';
import { expectMembership } from '../../../itemMembership/test/fixtures/memberships';

describe('Enroll', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  describe('Create Enroll', () => {
    it('returns valid object when successful', async () => {
      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [{ itemLoginSchema: {} }],
      });
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const itemMembership = await response.json();
      expectMembership(itemMembership, {
        creator: actor,
        item,
        permission: PermissionLevel.Read,
        account: actor,
      });
    });

    it('rejects when item login schema is frozen', async () => {
      const {
        actor,
        items: [anotherItem],
      } = await seedFromJson({
        items: [
          {
            itemLoginSchema: {
              status: ItemLoginSchemaStatus.Freeze,
            },
          },
        ],
      });
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${anotherItem.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new CannotEnrollFrozenItemLoginSchema());
    });

    it('rejects when item login schema is disabled, should not leak that there was an item login schema before.', async () => {
      const {
        actor,
        items: [anotherItem],
      } = await seedFromJson({
        items: [
          {
            itemLoginSchema: {
              status: ItemLoginSchemaStatus.Disabled,
            },
          },
        ],
      });

      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${anotherItem.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new CannotEnrollItemWithoutItemLoginSchema());
    });

    it('rejects when unauthenticated', async () => {
      unmockAuthenticate();
      const {
        items: [item],
      } = await seedFromJson({
        items: [{ itemLoginSchema: {} }],
      });
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('rejects when unauthenticated with non-existing item id', async () => {
      unmockAuthenticate();
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${uuid()}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });
    it('rejects when item does not exist', async () => {
      const { actor } = await seedFromJson();
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${uuid()}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('accepts when authenticated as the creator when there is no membership', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ creator: 'actor', itemLoginSchema: {} }],
      });
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const itemMembership = await response.json();
      expectMembership(itemMembership, {
        creator: actor,
        item,
        permission: PermissionLevel.Read,
        account: actor,
      });
    });
    it('rejects when authenticated as the creator with membership', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ creator: 'actor', memberships: [{ account: 'actor' }], itemLoginSchema: {} }],
      });
      mockAuthenticate(actor);
      assertIsDefined(actor);
      assertIsMember(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('rejects when already have a membership', async () => {
      const {
        items: [item],
        actor,
      } = await seedFromJson({
        items: [{ memberships: [{ account: 'actor' }], itemLoginSchema: {} }],
      });
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('rejects when there is no item login schema', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{ creator: 'actor' }],
      });
      mockAuthenticate(actor);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
  });
});
