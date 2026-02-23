import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { HttpMethod, PermissionLevel, TagCategory } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { AppDataSource } from '../../../../plugins/datasource';
import { saveMember } from '../../../member/test/fixtures/members';
import { Tag } from '../../../tag/Tag.entity';
import { Item } from '../../entities/Item';
import { ItemTestUtils } from '../../test/fixtures/items';
import { ItemTag } from './ItemTag.entity';

const testUtils = new ItemTestUtils();
const tagRawRepository = AppDataSource.getRepository(Tag);
const itemTagRawRepository = AppDataSource.getRepository(ItemTag);

const createTagsForItem = async (item: Item, tags: Tag[]): Promise<ItemTag[]> => {
  const itemTags: ItemTag[] = [];
  for (const t of tags) {
    itemTags.push(await itemTagRawRepository.save({ item, tag: t }));
  }
  return itemTags;
};

describe('Item Tag Endpoints', () => {
  let app: FastifyInstance;
  let actor;
  let tags: Tag[];

  beforeAll(async () => {
    ({ app } = await build({ member: null }));

    const tag1 = await tagRawRepository.save({ name: 'tag1', category: TagCategory.Discipline });
    const tag2 = await tagRawRepository.save({ name: 'tag2', category: TagCategory.Discipline });
    const tag3 = await tagRawRepository.save({ name: 'tag3', category: TagCategory.Level });

    tags = [tag1, tag2, tag3];
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    actor = null;
    unmockAuthenticate();
  });

  describe('GET /:itemId/tags', () => {
    it('Throw for invalid item id', async () => {
      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/items/invalid/tags`,
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    describe('Signed out', () => {
      it('Return tags for public item', async () => {
        const member = await saveMember();
        const { item } = await testUtils.savePublicItem({ member });
        await createTagsForItem(item, tags);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/tags`,
        });
        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toEqual(expect.arrayContaining(tags));
      });

      it('Throws for private item', async () => {
        const member = await saveMember();
        const item = await testUtils.saveItem({ actor: member });
        await createTagsForItem(item, tags);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/tags`,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Return tags for private item', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor, creator: member });
        await createTagsForItem(item, tags);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/tags`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toEqual(expect.arrayContaining(tags));
      });

      it('Return no tag', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/tags`,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);
        expect(response.json()).toHaveLength(0);
      });

      it('Throw if does not have access to item', async () => {
        const member = await saveMember();
        const item = await testUtils.saveItem({ actor: member, item: { id: v4() } });
        await createTagsForItem(item, tags);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/tags`,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });

  describe('POST /:itemId/tags', () => {
    it('Throw for invalid item id', async () => {
      const response = await app.inject({
        method: HttpMethod.Post,
        url: `/items/invalid/tags`,
        payload: { name: 'name', category: TagCategory.Discipline },
      });
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    describe('Signed out', () => {
      it('Cannot add tag', async () => {
        const member = await saveMember();
        const { item } = await testUtils.savePublicItem({ member });
        await createTagsForItem(item, tags);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/${item.id}/tags`,
          payload: { name: 'name', category: TagCategory.Discipline },
        });
        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Add tag for private item', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor, creator: member });
        await createTagsForItem(item, tags);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/${item.id}/tags`,
          payload: { name: 'name', category: TagCategory.Discipline },
        });

        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      });

      it('Cannot add tag with wrong category', async () => {
        const { item } = await testUtils.saveItemAndMembership({ member: actor });

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/${item.id}/tags`,
          payload: { name: 'name', category: 'wrong' },
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throw if does not have access to item', async () => {
        const member = await saveMember();
        const item = await testUtils.saveItem({ actor: member });
        await createTagsForItem(item, tags);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/${item.id}/tags`,
          payload: { name: 'name', category: TagCategory.Discipline },
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
  describe('DELETE /:itemId/tags/:tagId', () => {
    describe('Input schema validation', () => {
      it('Throw for invalid item id', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/items/invalid/tags/${v4()}`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Throw for invalid tag id', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/items/${v4()}/tags/invalid}`,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });

    describe('Signed out', () => {
      it('Cannot delete tag', async () => {
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/items/${v4()}/tags/${v4()}`,
        });
        expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Delete tag for private item', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member: actor, creator: member });
        const itemTags = await createTagsForItem(item, tags);
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/items/${item.id}/tags/${itemTags[0].tagId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      });

      it('Cannot delete tag for item with write access', async () => {
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({
          member: actor,
          item: { id: v4() },
          creator: member,
          permission: PermissionLevel.Write,
        });
        const itemTags = await createTagsForItem(item, tags);
        const response = await app.inject({
          method: HttpMethod.Delete,
          url: `/items/${item.id}/tags/${itemTags[0].tagId}`,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
});
