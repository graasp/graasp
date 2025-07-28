/*
 * source: https://github.com/yjs/y-websocket-server/blob/main/src/utils.js
 */
import { eq } from 'drizzle-orm/sql';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as decoding from 'lib0/decoding';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as encoding from 'lib0/encoding';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { WebSocket } from 'ws';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as awarenessProtocol from 'y-protocols/awareness';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as syncProtocol from 'y-protocols/sync';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as Y from 'yjs';

import { db } from '../../../../drizzle/db';
import { pageTable } from '../../../../drizzle/schema';
import {
  headlessConvertLexicalJSONToYDocState,
  headlessConvertYDocStateToLexicalJSON,
} from './toLexical';

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;
const wsReadyStateClosing = 2; // eslint-disable-line
const wsReadyStateClosed = 3; // eslint-disable-line

const PERSIST_INTERVAL_IS_MS = 15000;
const DELETE_TIMEOUT = 30000;

// disable gc when using snapshots!
const gcEnabled = process.env.GC !== 'false' && process.env.GC !== '0';
type WrappedDoc = { doc: WSSharedDoc; saveInterval?: any; deleteTimeout?: any };

export const docs = new Map<string, WrappedDoc>();

const messageSync = 0;
const messageAwareness = 1;

const updateHandler = (update: Uint8Array, _origin: never, doc: WSSharedDoc, _tr: never) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  const message = encoding.toUint8Array(encoder);
  doc.conns.forEach((_, conn) => send(doc.name, conn, message));
};

let contentInitializor = (f) => Promise.resolve();

export const setContentInitializor = (f) => {
  contentInitializor = f;
};

const saveDocInDb = (doc: WSSharedDoc) => {
  const content = headlessConvertYDocStateToLexicalJSON([], Y.encodeStateAsUpdate(doc));
  console.log('--- SAVE !');

  db.transaction(async () => {
    await db
      .update(pageTable)
      .set({ content: JSON.stringify(content) })
      .where(eq(pageTable.itemId, doc.name));
  });
};

export class WSSharedDoc extends Y.Doc {
  name: string;
  awareness: awarenessProtocol.Awareness;
  conns: Map<WebSocket, Set<number>>;
  whenInitialized: Promise<void>;

  constructor(name) {
    super({ gc: gcEnabled });
    this.name = name;
    this.conns = new Map();
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);

    const awarenessChangeHandler = (
      {
        added,
        updated,
        removed,
      }: { added: Array<number>; updated: Array<number>; removed: Array<number> },
      conn: WebSocket | null,
    ) => {
      const changedClients = added.concat(updated, removed);
      if (conn !== null) {
        const connControlledIDs = this.conns.get(conn);
        if (connControlledIDs !== undefined) {
          added.forEach((clientID) => {
            connControlledIDs.add(clientID);
          });
          removed.forEach((clientID) => {
            connControlledIDs.delete(clientID);
          });
        }
      }
      // broadcast awareness update
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
      );
      const buff = encoding.toUint8Array(encoder);
      this.conns.forEach((_, c) => {
        send(this.name, c, buff);
      });
    };
    this.awareness.on('update', awarenessChangeHandler);
    this.on('update', updateHandler);
    this.whenInitialized = contentInitializor(this);
  }
}

/**
 * Gets a Y.Doc by name, whether in memory or on disk
 *
 * @param {string} docname - the name of the Y.Doc to find or create
 * @param {boolean} gc - whether to allow gc on the doc (applies only when created)
 * @return {WSSharedDoc}
 */
export const getDoc = (docName: string, gc: boolean = true): WrappedDoc => {
  console.log([...docs.entries()]);
  if (docs.get(docName)) {
    console.log('return existing doc');
    return docs.get(docName)!;
  }

  console.debug('Create new yjs document for', docName);

  const doc = new WSSharedDoc(docName);
  doc.gc = gc;

  headlessConvertLexicalJSONToYDocState(docName).then(async (persistedYdoc) => {
    const update = Y.encodeStateAsUpdate(persistedYdoc);
    Y.applyUpdate(doc, update);
  });

  docs.set(docName, { doc });

  return { doc };
};

const messageListener = (conn: WebSocket, ddd: any, message: Uint8Array) => {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);
    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, ddd.doc, conn);

        // If the `encoder` only contains the type of reply message and no
        // message, there is no need to send the message. When `encoder` only
        // contains the type of reply, its length is 1.
        if (encoding.length(encoder) > 1) {
          send(ddd, conn, encoding.toUint8Array(encoder));
        }
        break;
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(
          ddd.doc.awareness,
          decoding.readVarUint8Array(decoder),
          conn,
        );
        break;
      }
    }
  } catch (err) {
    console.error(err);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    doc.emit('error', [err]);
  }
};

const closeConn = (wd: WrappedDoc, conn: WebSocket) => {
  console.log('-------- CLOSE CONN!', wd.doc.name);
  const { doc, saveInterval } = wd;

  if (doc.conns.has(conn)) {
    const controlledIds: Set<number> = doc.conns.get(conn)!;
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);
    if (doc.conns.size === 0) {
      // we store state and destroy ydocument
      saveDocInDb(doc);

      // remove interval
      clearInterval(saveInterval);

      // do not delete doc right away
      const deleteTimeout = setTimeout(() => {
        docs.delete(doc.name);
        doc.destroy();
      }, DELETE_TIMEOUT);

      docs.set(wd.doc.name, { doc, deleteTimeout, saveInterval: undefined });
    }
  }
  conn.close();
};

const send = (name: string, conn: WebSocket, m: Uint8Array) => {
  const wrappedDoc = docs.get(name)!;

  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    console.log('ready?');
    closeConn(wrappedDoc, conn);
  }
  try {
    conn.send(m, {}, (err) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      err != null && closeConn(wrappedDoc, conn);
    });
  } catch (e) {
    console.error(e);
    console.log('send error');
    closeConn(wrappedDoc, conn);
  }
};

const pingTimeout = 30000;

export const setupWSConnection = (conn: WebSocket, itemId: string, { gc = true } = {}) => {
  conn.binaryType = 'arraybuffer';
  // get doc, initialize if it does not exist yet
  const wrappedDoc = getDoc(itemId, gc);
  const { doc, deleteTimeout } = wrappedDoc;

  // setup persist data in database at first connection
  if (deleteTimeout) {
    console.log('DO NOT DELETE', deleteTimeout);
    clearTimeout(deleteTimeout);
    const saveInterval = setInterval(() => {
      saveDocInDb(doc);
    }, PERSIST_INTERVAL_IS_MS);
    wrappedDoc.saveInterval = saveInterval;
  }

  doc.conns.set(conn, new Set());

  // listen and reply to events
  conn.on('message', (message: ArrayBuffer) =>
    messageListener(conn, wrappedDoc, new Uint8Array(message)),
  );

  // Check if connection is still alive
  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        console.log('NO PONG');
        closeConn(wrappedDoc, conn);
      }
      clearInterval(pingInterval);
    } else if (doc.conns.has(conn)) {
      pongReceived = false;
      try {
        conn.ping();
      } catch (e) {
        console.error(e);
        console.log('error ping');
        closeConn(wrappedDoc, conn);
        clearInterval(pingInterval);
      }
    }
  }, pingTimeout);

  conn.on('error', (e) => {
    console.error('Error in websockets:', e);
  });

  conn.on('close', (e, d) => {
    console.log('on close', e, d.toString());
    closeConn(wrappedDoc, conn);
    clearInterval(pingInterval);
  });

  conn.on('pong', () => {
    pongReceived = true;
  });
  // put the following in a variables in a block so the interval handlers don't keep in the scope
  {
    // send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    send(itemId, conn, encoding.toUint8Array(encoder));
    const awarenessStates = doc.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())),
      );
      send(itemId, conn, encoding.toUint8Array(encoder));
    }
  }
};
