/**
 * source: https://github.com/yjs/y-leveldb/blob/master/src/y-leveldb.js
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as Y from 'yjs';

import { DBConnection } from '../../../../drizzle/db';
import { PageRepository } from './page.repository';

export const PREFERRED_TRIM_SIZE = 500;

export class PagePersistence {
  private readonly pageRepository = new PageRepository();

  getYDoc(db: DBConnection, itemId: string): Promise<Y.Doc> {
    return db.transaction(async (dbConnection) => {
      const updates = await this.pageRepository.getUpdates(dbConnection, itemId);
      const ydoc = new Y.Doc();
      ydoc.transact(() => {
        for (const update of updates) {
          Y.applyUpdate(ydoc, update);
        }
      });
      if (updates.length > PREFERRED_TRIM_SIZE) {
        await this.resetDocumentUpdates(db, itemId, Y.encodeStateAsUpdate(ydoc));
      }
      return ydoc;
    });
  }

  storeUpdate(db: DBConnection, itemId: string, update: Uint8Array) {
    db.transaction(async (dbConnection) => await this.saveNewUpdate(dbConnection, itemId, update));
  }

  /**
   * Save new update
   * @param dbConnection
   * @param itemId
   * @param update
   * @returns new latest clock value
   */
  private async saveNewUpdate(
    dbConnection: DBConnection,
    itemId: string,
    update: Uint8Array,
  ): Promise<number> {
    const clock = await this.pageRepository.getCurrentUpdateClock(dbConnection, itemId);
    if (clock === -1) {
      // make sure that a state vector is aways written, so we can search for available documents
      const ydoc = new Y.Doc();
      Y.applyUpdate(ydoc, update);
    }
    await this.pageRepository.createUpdate(dbConnection, itemId, clock + 1, update);
    return clock + 1;
  }

  // NOTE: currently unused function, flushing happens on get when we have the full state of the document
  flushDocument(db: DBConnection, itemId: string) {
    return db.transaction(async (dbConnection) => {
      const updates = await this.pageRepository.getUpdates(dbConnection, itemId);
      const { update } = this.mergeUpdates(updates);
      await this.resetDocumentUpdates(dbConnection, itemId, update);
    });
  }

  /**
   * Save current state and remove redundant updates
   * @param db
   * @param itemId
   * @param stateAsUpdate
   * @returns current clock
   */
  private async resetDocumentUpdates(
    db: DBConnection,
    itemId: string,
    stateAsUpdate: Uint8Array,
  ): Promise<number> {
    const clock = await this.saveNewUpdate(db, itemId, stateAsUpdate);
    // intentionally not waiting for the promise to resolve! (from source)
    // clearing is not critical, the logic still works without clearing previous updates
    this.pageRepository.clearUpdatesRange(db, itemId, 0, clock).catch((e) => {
      console.error(e);
    });

    return clock;
  }

  /**
   * For now this is a helper method that creates a Y.Doc and then re-encodes a document update.
   * In the future this will be handled by Yjs without creating a Y.Doc (constant memory consumption).
   */
  private mergeUpdates(updates: Uint8Array[]) {
    const ydoc = new Y.Doc();
    ydoc.transact(() => {
      for (const update of updates) {
        Y.applyUpdate(ydoc, update);
      }
    });
    return { update: Y.encodeStateAsUpdate(ydoc), sv: Y.encodeStateVector(ydoc) };
  }
}
