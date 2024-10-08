import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { nullableAccountSchemaRef } from '../account/schemas';
import { itemIdSchemaRef, itemSchemaRef } from '../item/schema';

/**
 * JSON schema definitions to validate requests and responses
 * through Fastify's AJV instance
 */

export const messageParamSchemaRef = registerSchemaAsRef(
  'messageParam',
  'Message Param',
  Type.Object(
    {
      // Object Definition
      itemId: customType.UUID(),
      messageId: customType.UUID(),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const chatMessageSchemaRef = registerSchemaAsRef(
  'chatMessage',
  'Chat Message',
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      creator: nullableAccountSchemaRef,
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
      body: Type.String(),
      item: itemSchemaRef,
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const chatSchemaRef = registerSchemaAsRef(
  'chat',
  'Chat',
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      messages: Type.Array(chatMessageSchemaRef),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const createChatMessageSchemaRef = registerSchemaAsRef(
  'createChatMessage',
  'Create Chat Message',
  Type.Object(
    {
      // Object Definition
      body: Type.String(),
      mentions: Type.Optional(Type.Array(Type.String())),
    },
    {
      // Schema Options
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
