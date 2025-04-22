import { Websocket } from '@graasp/sdk';

/** The serializer should remove sensitive fields such as stack trace */
export type SerializedWebsocketError = Pick<Websocket.Error, 'name' | 'message'>;
