/**
 * JSON schema definitions to validate requests and responses
 * through Fastify's AJV instance
 */
import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { MentionStatus } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { accountSchemaRef } from '../../../account/account.schemas';
import { rawChatMessageSchemaRef } from '../../chatMessage.schemas';

export const minimalChatMentionSchemaRef = registerSchemaAsRef(
  'minimalChatMention',
  'Minimal Chat Mention',
  customType.StrictObject(
    {
      id: customType.UUID(),
      accountId: customType.UUID(),
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
      status: customType.EnumString(Object.values(MentionStatus)),
    },
    {
      description: 'Mention of a user in a chat, without message',
    },
  ),
);

export const completeChatMentionSchemaRef = registerSchemaAsRef(
  'completeChatMention',
  'Complete Chat Mention',
  Type.Intersect(
    [
      minimalChatMentionSchemaRef,
      customType.StrictObject({
        message: rawChatMessageSchemaRef,
      }),
      customType.StrictObject({
        account: accountSchemaRef,
      }),
    ],
    {
      description: 'Mention of a user in a chat including message',
      additionalProperties: false,
    },
  ),
);

export const getOwnMentions = {
  operationId: 'getOwnMentions',
  tags: ['chat', 'mention'],
  summary: 'Get mentions for current user',
  description: 'Get mentions for current user.',

  response: {
    [StatusCodes.OK]: Type.Array(completeChatMentionSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const patchMention = {
  operationId: 'patchMention',
  tags: ['chat', 'mention'],
  summary: 'Patch mention',
  description: "Patch mention's status.",

  params: customType.StrictObject({
    mentionId: customType.UUID(),
  }),
  body: customType.StrictObject({
    status: Type.Enum(MentionStatus),
  }),
  response: {
    [StatusCodes.OK]: minimalChatMentionSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteMention = {
  operationId: 'deleteMention',
  tags: ['chat', 'mention'],
  summary: 'Delete mention',
  description: 'Delete mention.',

  params: customType.StrictObject({
    mentionId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: minimalChatMentionSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const clearAllMentions = {
  operationId: 'clearAllMentions',
  tags: ['chat', 'mention'],
  summary: 'Clear all mentions for current user',
  description: 'Clear all mentions for current user.',

  response: {
    [StatusCodes.OK]: Type.Array(completeChatMentionSchemaRef),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
