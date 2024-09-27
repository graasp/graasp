import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { itemIdSchemaRef } from '../item/plugins/itemLike/schemas';

/**
 * JSON schema definitions to validate requests and responses
 * through Fastify's AJV instance
 */

export const messageParamSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      itemId: customType.UUID(),
      messageId: customType.UUID(),
    },
    {
      // Schema Options
      title: 'Message Param',
      $id: 'messageParam',
      additionalProperties: false,
    },
  ),
);

export const chatMessageSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      creator: Type.Ref('https://graasp.org/members/#/definitions/member'),
      createdAt: customType.Date(),
      updatedAt: customType.Date(),
      body: Type.String(),
      item: Type.Ref('https://graasp.org/items/#/definitions/item'),
    },
    {
      // Schema Options
      title: 'Chat Message',
      $id: 'chatMessage',
      additionalProperties: false,
    },
  ),
);

export const chatSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      messages: Type.Array(chatMessageSchemaRef),
    },
    {
      // Schema Options
      title: 'Chat',
      $id: 'chat',
      additionalProperties: false,
    },
  ),
);

export const createChatMessageSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      body: Type.String(),
      mentions: Type.Optional(Type.Array(Type.String())),
    },
    {
      // Schema Options
      title: 'Create Chat Message',
      $id: 'createChatMessage',
      additionalProperties: false,
    },
  ),
);

/**
 * JSON schema on GET chat route for request and response
 */
export const getChat = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: Type.Array(chatMessageSchemaRef),
  },
} as const satisfies FastifySchema;

/**
 * JSON schema on POST publish message route for request and response
 */
export const publishMessage = {
  params: itemIdSchemaRef,
  body: createChatMessageSchemaRef,
  response: {
    [StatusCodes.CREATED]: chatMessageSchemaRef,
  },
} as const satisfies FastifySchema;

/**
 * JSON schema on PATCH message route for request and response
 */
export const patchMessage = {
  params: messageParamSchemaRef,
  body: Type.Object({
    body: Type.String(),
  }),
  response: {
    [StatusCodes.OK]: chatMessageSchemaRef,
  },
} as const satisfies FastifySchema;

/**
 * JSON schema on DELETE remove message route for request and response
 */
export const deleteMessage = {
  params: messageParamSchemaRef,
  response: {
    [StatusCodes.OK]: chatMessageSchemaRef,
  },
} as const satisfies FastifySchema;

/**
 * JSON schema on DELETE clear chat route for request and response
 */
export const clearChat = {
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: chatSchemaRef,
  },
} as const satisfies FastifySchema;
