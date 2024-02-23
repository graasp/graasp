import { Websocket } from '@graasp/sdk';

export const createServerErrorResponse = (
  error: Error,
  request?: Websocket.ClientMessage,
): Websocket.ErrorServerResponse => ({
  realm: Websocket.Realms.Notif,
  type: Websocket.ServerMessageTypes.Response,
  status: Websocket.ResponseStatuses.Error,
  error,
  request,
});

export const createServerSuccessResponse = (
  request: Websocket.ClientMessage,
): Websocket.SuccessServerResponse => ({
  realm: Websocket.Realms.Notif,
  type: Websocket.ServerMessageTypes.Response,
  status: Websocket.ResponseStatuses.Success,
  request,
});

export const createServerInfo = (message: string, extra?: unknown): Websocket.ServerInfo => ({
  realm: Websocket.Realms.Notif,
  type: Websocket.ServerMessageTypes.Info,
  message,
  extra,
});

export const createServerUpdate = <BodyType>(
  topic: string,
  channel: string,
  body: BodyType,
): Websocket.ServerUpdate<BodyType> => ({
  realm: Websocket.Realms.Notif,
  type: Websocket.ServerMessageTypes.Update,
  topic,
  channel,
  body,
});
