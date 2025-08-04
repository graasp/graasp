/**
 * source: https://github.com/yjs/y-leveldb/blob/master/src/y-leveldb.js
 */
import { and, asc, desc, eq, gte, lt } from 'drizzle-orm/sql';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as Y from 'yjs';

import { DBConnection, db } from '../../../../drizzle/db';
import { pageUpdateTable } from '../../../../drizzle/schema';

export const PREFERRED_TRIM_SIZE = 20;

/**
 * Level expects a Buffer, but in Yjs we typically work with Uint8Arrays.
 *
 * Since Level thinks that these are two entirely different things,
 * we transform the Uint8array to a Buffer before storing it.
 *
 */
const levelPut = async (db: DBConnection, itemId: string, clock: number, update: Uint8Array) => {
  await db.insert(pageUpdateTable).values({ update, clock, itemId });
};

/**
 * Get all document updates for a specific document.
 */
export const getUpdates = async (db: DBConnection, docName: string) => {
  const updateEntries = await db.query.pageUpdateTable.findMany({
    where: eq(pageUpdateTable.itemId, docName),
    orderBy: asc(pageUpdateTable.clock),
  });
  return updateEntries.map(({ update }) => update);
};

export const getCurrentUpdateClock = async (db: DBConnection, docName: string): Promise<number> => {
  const lastUpdate = await db.query.pageUpdateTable.findFirst({
    where: eq(pageUpdateTable.itemId, docName),
    orderBy: desc(pageUpdateTable.clock),
  });
  return lastUpdate ? lastUpdate.clock : -1;
};

const clearUpdatesRange = async (
  dbConnection: DBConnection,
  docName: string,
  from: number,
  to: number,
): Promise<void> => {
  await dbConnection
    .delete(pageUpdateTable)
    .where(
      and(
        eq(pageUpdateTable.itemId, docName),
        gte(pageUpdateTable.clock, from),
        lt(pageUpdateTable.clock, to),
      ),
    );
};

/**
 * For now this is a helper method that creates a Y.Doc and then re-encodes a document update.
 * In the future this will be handled by Yjs without creating a Y.Doc (constant memory consumption).
 */
const mergeUpdates = (updates: Uint8Array[]) => {
  const ydoc = new Y.Doc();
  ydoc.transact(() => {
    for (let i = 0; i < updates.length; i++) {
      Y.applyUpdate(ydoc, updates[i]);
    }
  });
  return { update: Y.encodeStateAsUpdate(ydoc), sv: Y.encodeStateVector(ydoc) };
};

const flushDocument = async (db: DBConnection, docName: string, stateAsUpdate: Uint8Array) => {
  const clock = await storeUpdate(db, docName, stateAsUpdate);
  clearUpdatesRange(db, docName, 0, clock); // intentionally not waiting for the promise to resolve!

  return clock;
};

const storeUpdate = async (dbConnection: DBConnection, docName: string, update: Uint8Array) => {
  const clock = await getCurrentUpdateClock(dbConnection, docName);
  if (clock === -1) {
    // make sure that a state vector is aways written, so we can search for available documents
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, update);
  }
  await levelPut(dbConnection, docName, clock + 1, update);
  return clock + 1;
};

export class DrizzlePersistence {
  flushDocument(docName: string) {
    return db.transaction(async (dbConnection: DBConnection) => {
      const updates = await getUpdates(dbConnection, docName);
      const { update } = mergeUpdates(updates);
      await flushDocument(dbConnection, docName, update);
    });
  }

  getYDoc(docName: string): Promise<Y.Doc> {
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

  storeUpdate(docName: string, update: Uint8Array) {
    return db.transaction(async (dbConnection) => await storeUpdate(dbConnection, docName, update));
  }
}
