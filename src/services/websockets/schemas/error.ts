import { JTDSchemaType } from 'ajv/dist/jtd';

import { Websocket } from '@graasp/sdk';

/** The serializer should remove sensitive fields such as stack trace */
export type SerializedWebsocketError = Pick<Websocket.Error, 'name' | 'message'>;

/**
 * Error schema
 * {@link Websocket.Error}
 * See:
 *  https://ajv.js.org/guide/typescript.html
 *  https://ajv.js.org/json-type-definition.html
 */
export const errorSchema: JTDSchemaType<SerializedWebsocketError> = {
  properties: {
    name: {
      type: 'string',
    },
    message: { type: 'string' },
  },
};
