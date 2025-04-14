import { seedFromJson } from '../../../../../../test/mocks/seed';
import { client, db } from '../../../../../drizzle/db';
import { publishedItemsTable } from '../../../../../drizzle/schema';
import { ItemPublishedRepository } from './itemPublished.repository';

const repository = new ItemPublishedRepository();

describe('ItemPublishedRepository', () => {
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

      // publish item
      await db.insert(publishedItemsTable).values({ itemPath: item.path });

      const result = await repository.touchUpdatedAt(db, item.path);
      expect(new Date(result!).getTime() - new Date(updatedAt).getTime()).toBeLessThanOrEqual(200);
    });

    it('return null if item is not published', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        items: [{ creator: 'actor', type: 'folder' }],
      });
      // can not touch an item that was not published
      expect(await repository.touchUpdatedAt(db, item.path)).toBeNull();
    });
  });
});
