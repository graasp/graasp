import WebSocket from 'ws';

import { Websocket } from '@graasp/sdk';
import { ServerUpdate } from '@graasp/sdk/dist/services/websockets/api/server';

export class TestWsClient {
  private readonly ws: WebSocket;

  constructor(address: string) {
    this.ws = new WebSocket(address.replace('http', 'ws') + '/ws');
  }

  async send(payload: Websocket.ClientMessage): Promise<Websocket.ServerResponse> {
    return new Promise((resolve, reject) => {
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
      const update: ServerUpdate<UpdatesType> = JSON.parse(data.toString());
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
