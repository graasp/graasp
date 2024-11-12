import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod, TagCategory } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { AppDataSource } from '../../../../plugins/datasource';
import { saveMember } from '../../../member/test/fixtures/members';
import { Item } from '../../entities/Item';
import { ItemTestUtils } from '../../test/fixtures/items';
import { ItemTag } from './ItemTag.entity';
import { Tag } from './Tag.entity';

const testUtils = new ItemTestUtils();
const tagRawRepository = AppDataSource.getRepository(Tag);
const itemTagRawRepository = AppDataSource.getRepository(ItemTag);

const createTagsForItem = async (item: Item, tags: Tag[]) => {
  for (const t of tags) {
    await itemTagRawRepository.save({ item, tag: t });
  }
};

describe('Tag Endpoints', () => {
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
        expect(response.json()).toEqual(tags);
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
        expect(response.json()).toEqual(tags);
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
        const item = await testUtils.saveItem({ actor: member });
        await createTagsForItem(item, tags);

        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/items/${item.id}/tags`,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
});
