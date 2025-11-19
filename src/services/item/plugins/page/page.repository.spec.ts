import assert from 'assert';
import { eq } from 'drizzle-orm/sql';
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { Doc, encodeStateAsUpdate } from 'yjs';

import { ItemType } from '@graasp/sdk';

import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { pageUpdateTable } from '../../../../drizzle/schema';
import { PageRepository } from './page.repository';

const pageRepository = new PageRepository();

describe('PageRepository', () => {
  describe('createUpdate', () => {
    it('create new update', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{ type: ItemType.PAGE }] });

      // save an update for item through temporary doc
      const doc = new Doc();
      doc.getText('mytext').insert(0, 'abc');
      const update = encodeStateAsUpdate(doc);
      doc.destroy();

      await pageRepository.createUpdate(db, item.id, 2, update);
      const savedUpdate = await db.query.pageUpdateTable.findFirst({
        where: eq(pageUpdateTable.itemId, item.id),
      });
      assert(savedUpdate);
      expect(Buffer.from(update)).toEqual(Buffer.from(savedUpdate.update));
    });
  });
  describe('getCurrentUpdateClock', () => {
    it('get current clock', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{ type: ItemType.PAGE }] });

      // save an update for item through temporary doc
      const doc = new Doc();
      doc.getText('mytext').insert(0, 'abc');
      const update = encodeStateAsUpdate(doc);
      doc.destroy();
      await pageRepository.createUpdate(db, item.id, 2, update);

      const clock = await pageRepository.getCurrentUpdateClock(db, item.id);
      expect(clock).toEqual(2);
    });
    it('get -1 for no update', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{ type: ItemType.PAGE }] });

      const clock = await pageRepository.getCurrentUpdateClock(db, item.id);
      expect(clock).toEqual(-1);
    });
  });
  describe('getUpdates', () => {
    it('get updates clock', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{ type: ItemType.PAGE }] });

      // save an update for item through temporary doc
      const doc = new Doc();
      doc.getText('mytext').insert(0, 'abc');
      const update = encodeStateAsUpdate(doc);
      doc.destroy();
      await pageRepository.createUpdate(db, item.id, 2, update);
      await pageRepository.createUpdate(db, item.id, 3, update);
      await pageRepository.createUpdate(db, item.id, 4, update);

      const updates = await pageRepository.getUpdates(db, item.id);
      expect(updates).toHaveLength(3);
    });
    it('return empty for no update', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{ type: ItemType.PAGE }] });

      const clock = await pageRepository.getUpdates(db, item.id);
      expect(clock).toHaveLength(0);
    });
  });
  describe('clearUpdatesRange', () => {
    it('delete updates in range', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{ type: ItemType.PAGE }] });

      // save an update for item through temporary doc
      const doc = new Doc();
      doc.getText('mytext').insert(0, 'abc');
      const update = encodeStateAsUpdate(doc);
      doc.destroy();
      await pageRepository.createUpdate(db, item.id, 2, update);
      await pageRepository.createUpdate(db, item.id, 3, update);
      await pageRepository.createUpdate(db, item.id, 4, update);
      await pageRepository.createUpdate(db, item.id, 5, update);

      await pageRepository.clearUpdatesRange(db, item.id, 2, 4);
      const savedUpdates = await db.query.pageUpdateTable.findMany({
        where: eq(pageUpdateTable.itemId, item.id),
      });
      expect(savedUpdates).toHaveLength(2);
      expect(savedUpdates[0].clock).toEqual(4);
      expect(savedUpdates[1].clock).toEqual(5);
    });
    it('delete nothing if range is invalid', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{ type: ItemType.PAGE }] });

      // save an update for item through temporary doc
      const doc = new Doc();
      doc.getText('mytext').insert(0, 'abc');
      const update = encodeStateAsUpdate(doc);
      doc.destroy();
      await pageRepository.createUpdate(db, item.id, 2, update);
      await pageRepository.createUpdate(db, item.id, 3, update);
      await pageRepository.createUpdate(db, item.id, 4, update);
      await pageRepository.createUpdate(db, item.id, 5, update);

      await pageRepository.clearUpdatesRange(db, item.id, 4, 2);
      const savedUpdates = await db.query.pageUpdateTable.findMany({
        where: eq(pageUpdateTable.itemId, item.id),
      });
      expect(savedUpdates).toHaveLength(4);
    });
  });
});
