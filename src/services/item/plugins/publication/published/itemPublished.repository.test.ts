import { seedFromJson } from '../../../../../../test/mocks/seed';
import { client, db } from '../../../../../drizzle/db';
import { publishedItems } from '../../../../../drizzle/schema';
import { ItemPublishedNotFound } from './errors';
import { ItemPublishedRepository } from './itemPublished.repository';

const repository = new ItemPublishedRepository();

describe('ItemPublishedRepository', () => {
  beforeAll(async () => {
    await client.connect();
  });

  afterAll(() => {
    client.end();
  });

  describe('getForMember', () => {
    // SKIP: function has been commented out in the repository
    it.skip('get published items for member', async () => {
      // create 3 folders that we will then publish
      const { items } = await seedFromJson({
        items: [
          { creator: 'actor', type: 'folder' },
          { creator: 'actor', type: 'folder' },
          { creator: 'actor', type: 'folder' },
        ],
      });

      for (const i of items) {
        await db.insert(publishedItems).values({
          itemPath: i.path,
        });
      }

      // const result = await repository.getForMember(db, actor?.id);
      // expectManyItems(result, items);
    });
  });

  describe('touchUpdatedAt', () => {
    it('undefined path throws', async () => {
      await expect(() =>
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        repository.touchUpdatedAt(undefined),
      ).rejects.toThrow();
    });
    it('update updatedAt on current time', async () => {
      const updatedAt = new Date();
      const {
        items: [item],
      } = await seedFromJson({
        items: [{ creator: 'actor', type: 'folder' }],
      });
      // can not touch an item that was not published
      await expect(async () => await repository.touchUpdatedAt(db, item.path)).rejects.toThrow(
        new ItemPublishedNotFound(),
      );

      // publish item
      await db.insert(publishedItems).values({ itemPath: item.path });

      const result = await repository.touchUpdatedAt(db, item.path);
      expect(new Date(result).getTime() - new Date(updatedAt).getTime()).toBeLessThanOrEqual(200);
    });
  });
});
