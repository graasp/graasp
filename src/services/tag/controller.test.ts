import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { HttpMethod, TagCategory } from '@graasp/sdk';

import build, { clearDatabase, unmockAuthenticate } from '../../../test/app';
import { AppDataSource } from '../../plugins/datasource';
import { ItemTag } from '../item/plugins/tag/ItemTag.entity';
import { ItemTestUtils } from '../item/test/fixtures/items';
import { saveMember } from '../member/test/fixtures/members';
import { Tag } from '../tag/Tag.entity';

const testUtils = new ItemTestUtils();
const tagRawRepository = AppDataSource.getRepository(Tag);
const itemTagRawRepository = AppDataSource.getRepository(ItemTag);

describe('Tag Endpoints', () => {
  let app: FastifyInstance;
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
    unmockAuthenticate();
  });

  describe('GET /tags', () => {
    describe('Schema validation', () => {
      it('Throw for undefined search', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/tags`,
          query: { category: TagCategory.Discipline },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Throw for empty search', async () => {
        const response = await app.inject({
          method: HttpMethod.Get,
          url: `/tags`,
          query: { search: '', category: TagCategory.Discipline },
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });

    it('Return count', async () => {
      const member = await saveMember();
      const { item } = await testUtils.savePublicItem({ member });

      const itemTags: ItemTag[] = [];
      for (const t of tags) {
        itemTags.push(await itemTagRawRepository.save({ item, tag: t }));
      }

      const response = await app.inject({
        method: HttpMethod.Get,
        url: `/tags`,
        query: { search: 'tag', category: TagCategory.Discipline },
      });

      expect(response.statusCode).toBe(StatusCodes.OK);
      const data = response.json();
      expect(data).toHaveLength(2);
      for (const d of data) {
        expect(tags.map((t) => t.name)).toContain(d.name);
        expect(d.category).toEqual(TagCategory.Discipline);
        expect(d.count).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
