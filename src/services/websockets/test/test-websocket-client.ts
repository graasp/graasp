import { WebSocket } from 'ws';

import { Websocket } from '@graasp/sdk';

/**
 * A helper class to mock a purely WS client for the Graasp protocol
 */
export class TestWsClient {
  private readonly ws: WebSocket;
  private readonly ready: Promise<void>;

  constructor(address: string) {
    this.ws = new WebSocket(address.replace('http', 'ws') + '/api/ws');
    this.ready = new Promise((resolve) => {
      this.ws.on('open', () => {
        resolve();
      });
      this.ws.on('error', (err) => {
        throw err;
      });
    });
  }

  /**
   * Sends any {@link Websocket.ClientMessage} and return a promise with the response of the server
   */
  async send(payload: Websocket.ClientMessage): Promise<Websocket.ServerResponse> {
    await this.ready;
    return new Promise((resolve, _reject) => {
      const handler = (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === Websocket.ServerMessageTypes.Response) {
          resolve(message);
        }
        this.ws.off('message', handler);
      };

      this.ws.on('message', handler);
      this.ws.send(JSON.stringify(payload));
    });
  }

  /**
   * Sends a subscription to the given topic / channel pair and returns a mutable array of received updates
   */
  async subscribe<UpdatesType>({ topic, channel }: { topic: string; channel: string }) {
    const res = await this.send({
      realm: Websocket.Realms.Notif,
      action: Websocket.ClientActions.Subscribe,
      topic,
      channel,
    });

    if (res.status !== Websocket.ResponseStatuses.Success) {
      throw res;
    }

    /** Ordering is guaranteed in each channel through HTTP semantics */
    const updates: Array<UpdatesType> = [];

    this.ws.on('message', (data) => {
      const update: Websocket.ServerUpdate<UpdatesType> = JSON.parse(data.toString());
      if (
        update.type === Websocket.ServerMessageTypes.Update &&
        update.channel === channel &&
        update.topic === topic
      ) {
        updates.push(update.body);
      }
    });

    return updates;
  }

  close() {
    this.ws.close();
  }
}
