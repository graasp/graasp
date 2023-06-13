import { JTDSchemaType } from 'ajv/dist/jtd';

import { Websocket } from '@graasp/sdk';

/**
 * Client message schema
 * MUST conform to {@link Websocket.ClientMessage} (provide equivalent runtime types)
 * See:
 *  https://ajv.js.org/guide/typescript.html
 *  https://ajv.js.org/json-type-definition.html
 */
export const clientMessageSchema: JTDSchemaType<Websocket.ClientMessage> = {
  discriminator: 'action',
  mapping: {
    disconnect: {
      properties: {
        realm: { enum: ['notif'] },
      },
    },
    subscribe: {
      properties: {
        realm: { enum: ['notif'] },
        topic: { type: 'string' },
        channel: { type: 'string' },
      },
    },
    unsubscribe: {
      properties: {
        realm: { enum: ['notif'] },
        topic: { type: 'string' },
        channel: { type: 'string' },
      },
    },
    subscribeOnly: {
      properties: {
        realm: { enum: ['notif'] },
        topic: { type: 'string' },
        channel: { type: 'string' },
      },
    },
  },
};

/**
 * Server message schema
 * MUST conform to {@link Websocket.ServerMessage} (provide equivalent runtime types)
 * See:
 *  https://ajv.js.org/guide/typescript.html
 *  https://ajv.js.org/json-type-definition.html
 */
export const serverMessageSchema: JTDSchemaType<Websocket.ServerMessage> = {
  discriminator: 'type',
  mapping: {
    response: {
      properties: {
        realm: { enum: ['notif'] },
        status: {
          enum: ['success', 'error'],
        },
      },
      optionalProperties: {
        request: clientMessageSchema,
      },
      // allow server to optionally send an error property if status is Websocket.ReponseStatuses.Error
      // this is fine because we control the object value anyway
      additionalProperties: true,
    },
    info: {
      properties: {
        realm: { enum: ['notif'] },
        message: { type: 'string' },
      },
      optionalProperties: {
        extra: {},
      },
    },
    update: {
      properties: {
        realm: { enum: ['notif'] },
        topic: { type: 'string' },
        channel: { type: 'string' },
      },
      optionalProperties: {
        body: {},
      },
    },
  },
};
