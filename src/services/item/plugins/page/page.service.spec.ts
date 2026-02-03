import { eq } from 'drizzle-orm/sql';
import { describe, expect, it } from 'vitest';
import waitForExpect from 'wait-for-expect';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { Doc, encodeStateAsUpdate, encodeStateVector } from 'yjs';

import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { pageUpdateTable } from '../../../../drizzle/schema';
import { ItemService } from '../../item.service';
import { PageRepository } from './page.repository';
import { PageItemService } from './page.service';

const itemService = {} as ItemService;
const pageRepository = new PageRepository();
const pageItemService = new PageItemService(itemService, pageRepository);

describe('PageItemService', () => {
  describe('getYDoc', () => {
    it('get empty doc for page without updates', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{ type: 'page' }] });

      const doc = await pageItemService.getById(db, item.id);
      expect(doc).toBeDefined();
      expect(Buffer.from(encodeStateVector(doc))).toEqual(Buffer.from([0]));
    });

    it('get doc with state for page', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{ type: 'page' }] });

      // save an update for item through temporary doc
      const doc = new Doc();
      doc.on('update', async (update) => {
        await db.insert(pageUpdateTable).values({
          clock: 1,
          update,
          itemId: item.id,
        });
      });
      doc.getText('mytext').insert(0, 'abc');
      doc.getText('mytext').insert(1, 'abc');
      doc.getText('mytext').insert(2, 'abc');
      const docState = Buffer.from(encodeStateAsUpdate(doc));
      doc.destroy();

      // wait for updates to be asynchronously saved
      await waitForExpect(async () => {
        // expect doc to have all updates
        const initDoc = await pageItemService.getById(db, item.id);
        expect(initDoc).toBeDefined();
        expect(Buffer.from(encodeStateAsUpdate(initDoc))).toEqual(docState);
      });
    });

    it('merge updates if page has too many updates', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{ type: 'page' }] });

      // save lots of updates
      const doc = new Doc();
      doc.on('update', async (update) => {
        await db.insert(pageUpdateTable).values({
          clock: 1,
          update,
          itemId: item.id,
        });
      });
      for (let i = 0; i < 501; i++) {
        doc.getText('mytext').insert(0, 'abc');
      }
      const docState = encodeStateAsUpdate(doc);
      doc.destroy();

      // wait for updates to be asynchronously saved
      await waitForExpect(async () => {
        // expect doc to have all updates
        const initDoc = await pageItemService.getById(db, item.id);
        expect(initDoc).toBeDefined();
        expect(Buffer.from(encodeStateAsUpdate(initDoc))).toEqual(Buffer.from(docState));

        // db should contain less updates
        const updates = await db.query.pageUpdateTable.findMany({
          where: eq(pageUpdateTable.itemId, item.id),
        });
        expect(updates.length).toBeLessThan(10);
      });
    });
  });
  describe('storeUpdate', () => {
    it('save given update for item', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [{ type: 'page' }] });

      // generate an update through temporary doc
      const tmpDoc = new Doc();
      tmpDoc.getText('mytext').insert(0, 'abc');
      const update = encodeStateAsUpdate(tmpDoc);
      tmpDoc.destroy();

      await waitForExpect(async () => {
        pageItemService.storeUpdate(db, item.id, update);
        const savedUpdate = await db.query.pageUpdateTable.findMany({
          where: eq(pageUpdateTable.itemId, item.id),
        });
        expect(savedUpdate).toHaveLength(1);
        expect(Buffer.from(savedUpdate[0].update)).toEqual(Buffer.from(update));
      });
    });
  });
  describe('copy', () => {
    it('copy empty page', async () => {
      const {
        items: [item, copy],
      } = await seedFromJson({ items: [{ type: 'page' }, { type: 'page' }] });

      await pageItemService.copy(db, item.id, copy.id);
      const savedUpdate = await db.query.pageUpdateTable.findMany({
        where: eq(pageUpdateTable.itemId, copy.id),
      });
      expect(savedUpdate).toHaveLength(1);

      const originalDoc = await pageItemService.getById(db, item.id);
      expect(Buffer.from(savedUpdate[0].update)).toEqual(
        Buffer.from(encodeStateAsUpdate(originalDoc)),
      );
    });
    it('copy page and save merged update', async () => {
      const {
        items: [item, copy],
      } = await seedFromJson({ items: [{ type: 'page' }, { type: 'page' }] });

      // generate updates through temporary doc
      const tmpDoc = new Doc();
      tmpDoc.getText('mytext').insert(0, 'abc');
      const update1 = encodeStateAsUpdate(tmpDoc);
      tmpDoc.getText('mytext').insert(1, 'abc1');
      const update2 = encodeStateAsUpdate(tmpDoc);
      await db.insert(pageUpdateTable).values([
        { itemId: item.id, clock: 1, update: update1 },
        { itemId: item.id, clock: 2, update: update2 },
      ]);
      tmpDoc.destroy();

      await pageItemService.copy(db, item.id, copy.id);
      const savedUpdate = await db.query.pageUpdateTable.findMany({
        where: eq(pageUpdateTable.itemId, copy.id),
      });
      expect(savedUpdate).toHaveLength(1);

      const originalDoc = await pageItemService.getById(db, item.id);
      expect(Buffer.from(savedUpdate[0].update)).toEqual(
        Buffer.from(encodeStateAsUpdate(originalDoc)),
      );
    });
  });
});
