import { describe, expect, it } from 'vitest';

import { seedFromJson } from '../../../../../../test/mocks/seed';
import { db } from '../../../../../drizzle/db';
import { ItemPublishedRepository } from './itemPublished.repository';

const repository = new ItemPublishedRepository();

describe('ItemPublishedRepository', () => {
  describe('touchUpdatedAt', () => {
    it('undefined path throws', async () => {
      await expect(() =>
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        repository.touchUpdatedAt(db, undefined),
      ).rejects.toThrowError(new Error('path is not defined'));
    });

    it('update updatedAt on current time', async () => {
      const updatedAt = new Date();
      const {
        items: [item],
      } = await seedFromJson({
        items: [{ creator: 'actor', type: 'folder', isPublished: true, isPublic: true }],
      });

      const result = await repository.touchUpdatedAt(db, item.path);
      expect(new Date(result!).getTime() - new Date(updatedAt).getTime()).toBeLessThanOrEqual(1000);
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
