/**
 * source: https://github.com/yjs/y-leveldb/blob/master/src/y-leveldb.js
 */
import { and, asc, desc, eq, gte, lt } from 'drizzle-orm/sql';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as Y from 'yjs';

import { DBConnection, db } from '../../../../drizzle/db';
import { pageTable } from '../../../../drizzle/schema';

export const PREFERRED_TRIM_SIZE = 10;

/**
 * Level expects a Buffer, but in Yjs we typically work with Uint8Arrays.
 *
 * Since Level thinks that these are two entirely different things,
 * we transform the Uint8array to a Buffer before storing it.
 *
 * @param {any} db
 * @param {any} key
 * @param {Uint8Array} val
 */
const levelPut = async (db, itemId, clock, update) => {
  await db.insert(pageTable).values({ update, clock, itemId });
};

/**
 * Get all document updates for a specific document.
 */
export const getUpdates = async (db: DBConnection, docName: string) => {
  const updateEntries = await db.query.pageTable.findMany({
    where: eq(pageTable.itemId, docName),
    orderBy: asc(pageTable.clock),
  });
  return updateEntries.map(({ update }) => update);
};

export const getCurrentUpdateClock = async (db: DBConnection, docName: string): Promise<number> => {
  const lastUpdate = await db.query.pageTable.findFirst({
    where: eq(pageTable.itemId, docName),
    orderBy: desc(pageTable.clock),
  });
  return lastUpdate ? lastUpdate.clock : -1;
};

/**
 * @param {any} db
 * @param {Array<string|number>} gte Greater than or equal
 * @param {Array<string|number>} lt lower than (not equal)
 * @return {Promise<void>}
 */
const clearUpdatesRange = async (dbConnection: DBConnection, docName: string, from, to) => {
  await dbConnection
    .delete(pageTable)
    .where(and(eq(pageTable.itemId, docName), gte(pageTable.clock, from), lt(pageTable.clock, to)));
};

/**
 * For now this is a helper method that creates a Y.Doc and then re-encodes a document update.
 * In the future this will be handled by Yjs without creating a Y.Doc (constant memory consumption).
 *
 * @param {Array<Uint8Array>} updates
 * @return {{update:Uint8Array, sv: Uint8Array}}
 */
const mergeUpdates = (updates) => {
  const ydoc = new Y.Doc();
  ydoc.transact(() => {
    for (let i = 0; i < updates.length; i++) {
      Y.applyUpdate(ydoc, updates[i]);
    }
  });
  return { update: Y.encodeStateAsUpdate(ydoc), sv: Y.encodeStateVector(ydoc) };
};

/**
 * @param {any} db
 * @param {string} docName
 * @param {Uint8Array} stateAsUpdate
 * @param {Uint8Array} stateVector
 * @return {Promise<number>} returns the clock of the flushed doc
 */
const flushDocument = async (db, docName, stateAsUpdate) => {
  const clock = await storeUpdate(db, docName, stateAsUpdate);
  clearUpdatesRange(db, docName, 0, clock); // intentionally not waiting for the promise to resolve!

  return clock;
};

/**
 * @param {any} db
 * @param {string} docName
 * @param {Uint8Array} update
 * @return {Promise<number>} Returns the clock of the stored update
 */
const storeUpdate = async (dbConnection, docName, update) => {
  const clock = await getCurrentUpdateClock(dbConnection, docName);
  if (clock === -1) {
    // make sure that a state vector is aways written, so we can search for available documents
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, update);
    const sv = Y.encodeStateVector(ydoc);
    // await writeStateVector(db, docName, sv, 0);
  }
  await levelPut(dbConnection, docName, clock + 1, update);
  return clock + 1;
};

export class DrizzlePersistence {
  /**
   * @param {object} opts
   * @param {any} [opts.Level] Level-compatible adapter. E.g. leveldown, level-rem, level-indexeddb. Defaults to `level`
   * @param {object} [opts.levelOptions] Options that are passed down to the level instance
   */
  constructor() {}

  /**
   * @param {string} docName
   */
  flushDocument(docName) {
    return db.transaction(async (dbConnection: DBConnection) => {
      const updates = await getUpdates(dbConnection, docName);
      const { update, sv } = mergeUpdates(updates);
      await flushDocument(dbConnection, docName, update, sv);
    });
  }

  /**
   * @param {string} docName
   * @return {Promise<Y.Doc>}
   */
  getYDoc(docName) {
    return db.transaction(async (dbConnection) => {
      const updates = await getUpdates(dbConnection, docName);
      const ydoc = new Y.Doc();
      ydoc.transact(() => {
        for (let i = 0; i < updates.length; i++) {
          Y.applyUpdate(ydoc, updates[i]);
        }
      });
      if (updates.length > PREFERRED_TRIM_SIZE) {
        await flushDocument(db, docName, Y.encodeStateAsUpdate(ydoc));
      }
      return ydoc;
    });
  }

  /**
   * @param {string} docName
   * @param {Uint8Array} update
   * @return {Promise<number>} Returns the clock of the stored update
   */
  storeUpdate(docName, update) {
    return db.transaction((dbConnection) => storeUpdate(dbConnection, docName, update));
  }
}
