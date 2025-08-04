/* source: https://github.com/yjs/y-websocket-server/blob/main/src/utils.js */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as decoding from 'lib0/decoding';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as encoding from 'lib0/encoding';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as map from 'lib0/map';
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

import { DrizzlePersistence } from './DrizzlePersistence';

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;

const PING_TIMEOUT = 30000;

const dp = new DrizzlePersistence();
const bindState = async (pageId: string, ydoc: Y.Doc) => {
  const persistedYdoc = await dp.getYDoc(pageId);
  const newUpdates = Y.encodeStateAsUpdate(ydoc);
  dp.storeUpdate(pageId, newUpdates);
  Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));
  ydoc.on('update', (update) => {
    dp.storeUpdate(pageId, update);
  });
};

export const docs = new Map<string, WSSharedDoc>();

const messageSync = 0;
const messageAwareness = 1;

const updateHandler = (update: Uint8Array, _origin: never, doc: WSSharedDoc) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  const message = encoding.toUint8Array(encoder);
  doc.conns.forEach((_, conn) => send(doc, conn, message));
};

export class WSSharedDoc extends Y.Doc {
  name: string;
  awareness: awarenessProtocol.Awareness;
  conns: Map<WebSocket, Set<number>>;

  constructor(name: string) {
    super();
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
        send(this, c, buff);
      });
    };
    this.awareness.on('update', awarenessChangeHandler);
    this.on('update', updateHandler);
  }
}

/**
 * Gets a Y.Doc by name, whether in memory or in db
 *
 * @param {string} pageId - the name of the Y.Doc to find or create
 * @return {WSSharedDoc}
 */
export const getYDoc = (pageId: string): WSSharedDoc =>
  map.setIfUndefined(docs, pageId, () => {
    const doc = new WSSharedDoc(pageId);
    bindState(pageId, doc);
    docs.set(pageId, doc);
    return doc;
  });

const messageListener = (conn: WebSocket, doc: WSSharedDoc, message: Uint8Array) => {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);
    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn);

        // If the `encoder` only contains the type of reply message and no
        // message, there is no need to send the message. When `encoder` only
        // contains the type of reply, its length is 1.
        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder));
        }
        break;
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(
          doc.awareness,
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

const closeConn = (doc: WSSharedDoc, conn: WebSocket) => {
  if (doc.conns.has(conn)) {
    const controlledIds: Set<number> = doc.conns.get(conn)!;
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(controlledIds), null);
    doc.destroy();
    docs.delete(doc.name);
  }
  conn.close();
};

const send = (doc: WSSharedDoc, conn: WebSocket, m: Uint8Array) => {
  if (conn.readyState !== wsReadyStateConnecting && conn.readyState !== wsReadyStateOpen) {
    closeConn(doc, conn);
  }
  try {
    conn.send(m, {}, (err) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      err != null && closeConn(doc, conn);
    });
  } catch (e) {
    console.error(e);
    closeConn(doc, conn);
  }
};

export const setupWSConnection = (conn: WebSocket, pageId: string) => {
  conn.binaryType = 'arraybuffer';
  // get doc, initialize if it does not exist yet
  const doc = getYDoc(pageId);
  doc.conns.set(conn, new Set());

  // listen and reply to events
  conn.on('message', (message: ArrayBuffer) => messageListener(conn, doc, new Uint8Array(message)));

  // Check if connection is still alive
  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        closeConn(doc, conn);
      }
      clearInterval(pingInterval);
    } else if (doc.conns.has(conn)) {
      pongReceived = false;
      try {
        conn.ping();
      } catch (e) {
        console.error(e);
        closeConn(doc, conn);
        clearInterval(pingInterval);
      }
    }
  }, PING_TIMEOUT);

  conn.on('close', () => {
    closeConn(doc, conn);
    clearInterval(pingInterval);
  });

  conn.on('pong', () => {
    pongReceived = true;
  });
  // put the following in a variables in a block so the interval handlers don't keep in in
  // scope
  {
    // send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, doc);
    send(doc, conn, encoding.toUint8Array(encoder));
    const awarenessStates = doc.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())),
      );
      send(doc, conn, encoding.toUint8Array(encoder));
    }
  }
};
