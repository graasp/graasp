/* source: https://github.com/yjs/y-websocket-server/blob/main/src/utils.js */
import { captureException } from '@sentry/node';
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
import { WSDoc } from './WSDoc';
import { MESSAGE_AWARENESS_CODE, MESSAGE_SYNC_CODE, PING_TIMEOUT } from './constants';
import { PageItemService } from './page.service';

/**
 * In-memory storage of currently used yjs docs and readonly yjs docs
 * For a page item, there might exist one instance in docs (for writers) and one instance in readDocs (for readers)
 * or in either one
 */
export const docs = new Map<string, WSSharedDoc>();
export const readDocs = new Map<string, WSReadDoc>();

/**
 * Yjs document wrapper for write usage
 * Handles updates for awareness
 * Save document updates in database
 */
class WSSharedDoc extends WSDoc {
  static buildOrigin(name: string) {
    return name + '_shared';
  }

  constructor(pageItemService: PageItemService, name: string) {
    super(pageItemService, name, true);

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

  closeConn(conn: WebSocket, code = 1000, reason?: string) {
    super.closeConn(conn, code, reason);
    if (this.conns.size === 0) {
      docs.delete(this.name);
    }
  }

  private async bindState(pageId: string) {
    try {
      // get updates from database and apply on the yjs doc
      const persistedYdoc = await this.pageItemService.getById(db, pageId);
      const newUpdates = Y.encodeStateAsUpdate(this);
      this.pageItemService.storeUpdate(db, pageId, newUpdates);
      Y.applyUpdate(this, Y.encodeStateAsUpdate(persistedYdoc));

      // on yjs document update, the update is store in the database
      this.on('update', (update) => {
        this.pageItemService.storeUpdate(db, pageId, update);
      });
    } catch (e) {
      console.error('An error occured while binding the state:', e);
      // send error to sentry
      captureException(e);

      this.conns.forEach((v, conn) => {
        // close connections for unexpected error
        this.closeConn(conn, 1011);
      });
    }
  }
}

/**
 * Yjs document wrapper for read usage
 * Receive updates from corresponding write doc
 */
class WSReadDoc extends WSDoc {
  private SYNC_ORIGIN = 'sync';

  constructor(pageItemService: PageItemService, name: string) {
    super(pageItemService, name, false);
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
    try {
      const persistedYdoc = await this.pageItemService.getById(db, pageId);
      Y.applyUpdate(this, Y.encodeStateAsUpdate(persistedYdoc), this.SYNC_ORIGIN);
    } catch (e) {
      console.error('An error occured while binding the state:', e);
      // send error to sentry
      captureException(e);
      this.conns.forEach((v, conn) => {
        // close connections for unexpected error
        this.closeConn(conn, 1011);
      });
    }
  }

  closeConn(conn: WebSocket, code = 1000, reason?: string) {
    super.closeConn(conn, code, reason);
    if (this.conns.size === 0) {
      readDocs.delete(this.name);
    }
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
export const setupWSConnectionForWriters = (
  conn: WebSocket,
  pageId: string,
  pageItemService: PageItemService,
) => {
  conn.binaryType = 'arraybuffer';
  // get doc, initialize if it does not exist yet
  const doc = map.setIfUndefined(docs, pageId, () => {
    const doc = new WSSharedDoc(pageItemService, pageId);

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
export const setupWSConnectionForRead = (
  conn: WebSocket,
  pageId: string,
  pageItemService: PageItemService,
) => {
  conn.binaryType = 'arraybuffer';
  // get doc, initialize if it does not exist yet
  const doc = map.setIfUndefined(readDocs, pageId, () => {
    const doc = new WSReadDoc(pageItemService, pageId);
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
