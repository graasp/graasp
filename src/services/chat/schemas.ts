import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { nullableAccountSchemaRef } from '../account/schemas';
import { itemSchemaRef } from '../item/schemas';

/**
 * JSON schema definitions to validate requests and responses
 * through Fastify's AJV instance
 */

export const chatMessageSchemaRef = registerSchemaAsRef(
  'chatMessage',
  'Chat Message',
  customType.StrictObject(
    {
      id: customType.UUID(),
      creator: nullableAccountSchemaRef,
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
      body: Type.String(),
      item: itemSchemaRef,
    },
    {
      description: 'Message from a member in a chat of an item.',
    },
  ),
);

export const chatSchemaRef = registerSchemaAsRef(
  'chat',
  'Chat',
  customType.StrictObject(
    {
      id: customType.UUID(),
      messages: Type.Array(chatMessageSchemaRef),
    },
    {
      description: 'Chat object of an item with its messages.',
    },
  ),
);

/**
 * JSON schema on GET chat route for request and response
 */
export const getChat = {
  operationId: 'getChat',
  tags: ['chat'],
  summary: 'Get chat',
  description: 'Get chat object for given item.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(chatMessageSchemaRef, { description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

/**
 * JSON schema on POST publish message route for request and response
 */
export const createChatMessage = {
  operationId: 'createChatMessage',
  tags: ['chat'],
  summary: 'Save message in chat',
  description: 'Save message in chat for given item.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  body: customType.StrictObject({
    body: Type.String(),
    mentions: Type.Optional(Type.Array(Type.String())),
  }),
  response: {
    [StatusCodes.CREATED]: chatMessageSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

/**
 * JSON schema on PATCH message route for request and response
 */
export const patchMessage = {
  operationId: 'patchChatMessage',
  tags: ['chat'],
  summary: 'Edit message in chat',
  description: 'Edit message in chat for given item.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
    messageId: customType.UUID(),
  }),
  body: customType.StrictObject({
    body: Type.String(),
  }),
  response: {
    [StatusCodes.OK]: chatMessageSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

/**
 * JSON schema on DELETE remove message route for request and response
 */
export const deleteMessage = {
  operationId: 'deleteChatMessage',
  tags: ['chat'],
  summary: 'Delete message in chat',
  description: 'Delete message in chat for given item.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
    messageId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: chatMessageSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

/**
 * JSON schema on DELETE clear chat route for request and response
 */
export const clearChat = {
  operationId: 'clearChatMessage',
  tags: ['chat'],
  summary: 'Clear messages of chat',
  description: 'Clear messages of chat for given item.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: chatSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
