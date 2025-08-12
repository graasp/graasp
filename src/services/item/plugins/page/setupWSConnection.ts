/* source: https://github.com/yjs/y-websocket-server/blob/main/src/utils.js */
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

import { db } from '../../../../drizzle/db';
import { PagePersistence } from './PagePersistence';
import { WSDoc } from './WSDoc';
import { MESSAGE_AWARENESS_CODE, MESSAGE_SYNC_CODE, PING_TIMEOUT } from './constants';

/**
 * In-memory storage of currently used yjs docs and readonly yjs docs
 * For a page item, there might exist one instance in docs (for writers) and one instance in readDocs (for readers)
 * or in either one
 */
export const docs = new Map<string, WSSharedDoc>();
export const readDocs = new Map<string, WSReadDoc>();

/**
 * Storage management for pages, dealing with updates from yjs
 */
const persistence = new PagePersistence();

/**
 * Yjs document wrapper for write usage
 * Handles updates for awareness
 * Save document updates in database
 */
class WSSharedDoc extends WSDoc {
  static buildOrigin(name: string) {
    return name + '_shared';
  }

  constructor(name: string) {
    super(name, true);

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
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS_CODE);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients),
      );
      const buff = encoding.toUint8Array(encoder);
      this.conns.forEach((_, c) => {
        this.send(c, buff);
      });
    };
    this.awareness.on('update', awarenessChangeHandler);

    // send yjs doc updates to all connections
    this.on('update', (update: Uint8Array) => {
      this.broadcastUpdate(update);
    });

    // send yjs doc updates to corresponding read doc if it exists
    this.on('update', (update) => {
      const readDoc = readDocs.get(this.name);
      if (readDoc) {
        Y.applyUpdate(readDoc, update, WSSharedDoc.buildOrigin(this.name));
      }
    });

    this.bindState(name);
  }

  closeConn(conn: WebSocket) {
    super.closeConn(conn);
    docs.delete(this.name);
  }

  private async bindState(pageId: string) {
    // get updates from database and apply on the yjs doc
    const persistedYdoc = await persistence.getYDoc(db, pageId);
    const newUpdates = Y.encodeStateAsUpdate(this);
    persistence.storeUpdate(db, pageId, newUpdates);
    Y.applyUpdate(this, Y.encodeStateAsUpdate(persistedYdoc));

    // on yjs document update, the update is store in the database
    this.on('update', (update) => {
      persistence.storeUpdate(db, pageId, update);
    });
  }
}

/**
 * Yjs document wrapper for read usage
 * Receive updates from corresponding write doc
 */
class WSReadDoc extends WSDoc {
  private SYNC_ORIGIN = 'sync';

  constructor(name: string) {
    super(name, false);
    this.bindState(name);

    // send yjs doc updates to all connections
    // only if origin is from shared doc or sync update
    this.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === WSSharedDoc.buildOrigin(this.name) || origin === this.SYNC_ORIGIN) {
        this.broadcastUpdate(update);
      }
    });
  }

  private async bindState(pageId: string) {
    const persistedYdoc = await persistence.getYDoc(db, pageId);
    Y.applyUpdate(this, Y.encodeStateAsUpdate(persistedYdoc), this.SYNC_ORIGIN);
  }

  closeConn(conn: WebSocket) {
    super.closeConn(conn);
    readDocs.delete(this.name);
  }
}

/**
 * Setup ping pong events to close the websocket connection when necessary
 * @param conn websocket connection
 * @param doc yjs document
 */
function setupPingPong(conn: WebSocket, doc: WSDoc) {
  // Check if connection is still alive
  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) {
        doc.closeConn(conn);
      }
      clearInterval(pingInterval);
    } else if (doc.conns.has(conn)) {
      pongReceived = false;
      try {
        conn.ping();
      } catch (e) {
        console.error(e);
        doc.closeConn(conn);
        clearInterval(pingInterval);
      }
    }
  }, PING_TIMEOUT);

  conn.on('close', () => {
    doc.closeConn(conn);
    clearInterval(pingInterval);
  });

  conn.on('pong', () => {
    pongReceived = true;
  });
}

/**
 * Setup websocket connection for writer
 * @param conn websocket connection
 * @param pageId page id to connect to
 */
export const setupWSConnectionForWriters = (conn: WebSocket, pageId: string) => {
  conn.binaryType = 'arraybuffer';
  // get doc, initialize if it does not exist yet
  const doc = map.setIfUndefined(docs, pageId, () => {
    const doc = new WSSharedDoc(pageId);

    docs.set(pageId, doc);

    return doc;
  });
  doc.addConnection(conn);

  setupPingPong(conn, doc);

  // put the following in a variables in a block so the interval handlers don't keep in in
  // scope
  {
    // send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC_CODE);
    syncProtocol.writeSyncStep1(encoder, doc);
    doc.send(conn, encoding.toUint8Array(encoder));

    // send init awareness
    const awarenessStates = doc.awareness.getStates();
    if (awarenessStates.size > 0) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS_CODE);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(awarenessStates.keys())),
      );
      doc.send(conn, encoding.toUint8Array(encoder));
    }
  }
};

/**
 * Setup websocket connection for read user
 * @param conn websocket connection
 * @param pageId page id to connect to
 */
export const setupWSConnectionForRead = (conn: WebSocket, pageId: string) => {
  conn.binaryType = 'arraybuffer';
  // get doc, initialize if it does not exist yet
  const doc = map.setIfUndefined(readDocs, pageId, () => {
    const doc = new WSReadDoc(pageId);
    readDocs.set(pageId, doc);

    return doc;
  });
  doc.addConnection(conn);

  setupPingPong(conn, doc);

  // put the following in a variables in a block so the interval handlers don't keep in in
  // scope
  {
    // send sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC_CODE);
    syncProtocol.writeSyncStep1(encoder, doc);
    doc.send(conn, encoding.toUint8Array(encoder));
  }
};
