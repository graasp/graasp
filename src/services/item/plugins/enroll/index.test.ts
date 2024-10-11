import { StatusCodes } from 'http-status-codes';
import { v4 as uuid } from 'uuid';

import { FastifyInstance } from 'fastify';

import { DiscriminatedItem, HttpMethod, ItemLoginSchemaStatus, PermissionLevel } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { buildRepositories } from '../../../../utils/repositories';
import { Item } from '../../../item/entities/Item';
import { ItemTestUtils } from '../../../item/test/fixtures/items';
import {
  CannotEnrollFrozenItemLoginSchema,
  CannotEnrollItemWithoutItemLoginSchema,
} from '../../../itemLogin/errors';
import { saveItemLoginSchema } from '../../../itemLogin/test/index.test';
import { expectMembership } from '../../../itemMembership/test/fixtures/memberships';
import { Member } from '../../../member/entities/member';
import { saveMember } from '../../../member/test/fixtures/members';

const testUtils = new ItemTestUtils();

describe('Enroll', () => {
  let app: FastifyInstance;
  let member: Member;
  let creator: Member;
  let item: Item;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  beforeEach(async () => {
    member = await saveMember();
    creator = await saveMember();
    ({ item } = await testUtils.saveItemAndMembership({ member: creator }));
    // We're forced to cast to the DiscriminatedItem type because of the ItemLoginSchemaFactory from Graasp SDK
    await saveItemLoginSchema({ item: item as unknown as DiscriminatedItem });
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  describe('Create Enroll', () => {
    it('returns valid object when successful', async () => {
      mockAuthenticate(member);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const itemMembership = await response.json();
      expectMembership(itemMembership, {
        creator: member,
        item,
        permission: PermissionLevel.Read,
        account: member,
      });
    });

    it('rejects when item login schema is frozen', async () => {
      const { item: anotherItem } = await testUtils.saveItemAndMembership({ member: creator });
      // We're forced to cast to the DiscriminatedItem type because of the ItemLoginSchemaFactory from Graasp SDK
      await saveItemLoginSchema({
        item: anotherItem as unknown as DiscriminatedItem,
        status: ItemLoginSchemaStatus.Freeze,
      });

      mockAuthenticate(member);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${anotherItem.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new CannotEnrollFrozenItemLoginSchema());
    });

    it('rejects when item login schema is disabled, should not leak that there was an item login schema before.', async () => {
      const { item: anotherItem } = await testUtils.saveItemAndMembership({ member: creator });
      // We're forced to cast to the DiscriminatedItem type because of the ItemLoginSchemaFactory from Graasp SDK
      await saveItemLoginSchema({
        item: anotherItem as unknown as DiscriminatedItem,
        status: ItemLoginSchemaStatus.Disabled,
      });

      mockAuthenticate(member);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${anotherItem.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      expect(response.json()).toEqual(new CannotEnrollItemWithoutItemLoginSchema());
    });

    it('rejects when unauthenticated', async () => {
      unmockAuthenticate();
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
      mockAuthenticate(member);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${uuid()}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
    });
    it('accepts when authenticated as the creator when there is no membership', async () => {
      const { itemMembershipRepository } = buildRepositories();
      await itemMembershipRepository.deleteManyByItemPathAndAccount([
        { itemPath: item.path, accountId: creator.id },
      ]);
      mockAuthenticate(creator);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const itemMembership = await response.json();
      expectMembership(itemMembership, {
        creator,
        item,
        permission: PermissionLevel.Read,
        account: creator,
      });
    });
    it('rejects when authenticated as the creator with membership', async () => {
      mockAuthenticate(creator);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });
    it('rejects when already have a membership', async () => {
      await testUtils.saveMembership({
        item,
        account: member,
      });
      mockAuthenticate(member);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${item.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('rejects when there is no item login schema', async () => {
      const { item: anotherItem } = await testUtils.saveItemAndMembership({ member: creator });
      mockAuthenticate(member);

      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/${anotherItem.id}/enroll`,
      });

      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
  });
});
