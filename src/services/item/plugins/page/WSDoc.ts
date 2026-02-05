import { captureException } from '@sentry/node';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as decoding from 'lib0/decoding';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import * as encoding from 'lib0/encoding';
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

import { FastifyBaseLogger } from 'fastify';

import { MESSAGE_AWARENESS_CODE, MESSAGE_SYNC_CODE } from './constants';
import { PageItemService } from './page.service';

const wsReadyStateConnecting = 0;
const wsReadyStateOpen = 1;

/**
 * General wrapper of a yjs document
 * Broadcast updates to attached connections
 */
export class WSDoc extends Y.Doc {
  public awareness: awarenessProtocol.Awareness;
  public conns: Map<WebSocket, Set<number>>;

  protected name: string;
  protected enableAwareness: boolean;
  protected pageItemService: PageItemService;
  protected logger: FastifyBaseLogger;

  constructor(
    pageItemService: PageItemService,
    name: string,
    enableAwareness: boolean,
    logger: FastifyBaseLogger,
  ) {
    super();
    this.name = name;
    this.conns = new Map();
    this.enableAwareness = enableAwareness;
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);
    this.pageItemService = pageItemService;
    this.logger = logger;
  }

  protected broadcastUpdate(update: Uint8Array) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC_CODE);
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    this.conns.forEach((_, conn) => this.send(conn, message));
  }

  /**
   * Add a connection to the pool
   * @param conn
   */
  addConnection(conn: WebSocket) {
    this.logger.info(
      `Page ${this.name}: add connection to reach ${this.conns.size + 1}`,
    );
    this.conns.set(conn, new Set());
    // listen and reply to events
    conn.on('message', (message: ArrayBuffer) => {
      this.messageListener(conn, new Uint8Array(message));
    });
  }

  /*
   * Get message from other connections at WS connection level
   */
  messageListener(conn: WebSocket, message: Uint8Array) {
    try {
      const encoder = encoding.createEncoder();
      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);
      switch (messageType) {
        case MESSAGE_SYNC_CODE:
          this.logger.debug(`Page ${this.name}: receive message`);
          encoding.writeVarUint(encoder, MESSAGE_SYNC_CODE);
          syncProtocol.readSyncMessage(decoder, encoder, this, conn);

          // If the `encoder` only contains the type of reply message and no
          // message, there is no need to send the message. When `encoder` only
          // contains the type of reply, its length is 1.
          if (encoding.length(encoder) > 1) {
            this.send(conn, encoding.toUint8Array(encoder));
          }
          break;
        case MESSAGE_AWARENESS_CODE: {
          if (this.enableAwareness) {
            this.logger.debug(`Page ${this.name}: receive awareness`);
            awarenessProtocol.applyAwarenessUpdate(
              this.awareness,
              decoding.readVarUint8Array(decoder),
              conn,
            );
          }
          break;
        }
      }
    } catch (err) {
      this.logger.error(err);
      // send error to sentry
      captureException(err, { tags: { feature: 'page', pageId: this.name } });
      // close connection because receive message is unsupported
      this.closeConn(conn, 1003);
    }
  }

  /**
   * Send message to given connection
   * @param conn connection to receive message
   * @param m message
   */
  send(conn: WebSocket, m: Uint8Array) {
    if (
      conn.readyState !== wsReadyStateConnecting &&
      conn.readyState !== wsReadyStateOpen
    ) {
      this.closeConn(conn);
    }
    try {
      conn.send(m, {}, (err) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        err != null && this.closeConn(conn);
      });
    } catch (e) {
      this.logger.error(e);
      // send error to sentry
      captureException(e, { tags: { feature: 'page', pageId: this.name } });
      this.closeConn(conn);
    }
  }

  /**
   * Close given connection
   * @param conn connection to close
   */
  closeConn(conn: WebSocket, code = 1000, reason?: string) {
    this.logger.info(`Page ${this.name}: close connection ${code} ${reason}`);
    if (this.conns.has(conn)) {
      const controlledIds: Set<number> = this.conns.get(conn)!;
      this.conns.delete(conn);
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        Array.from(controlledIds),
        null,
      );
      if (this.conns.size === 0) {
        this.destroy();
      }
    }
    conn.close(code, reason);
  }
}
