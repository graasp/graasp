/**
 * JSON schema definitions to validate requests and responses
 * through Fastify's AJV instance
 */
import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { MentionStatus } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { accountSchemaRef } from '../../../account/schemas';
import { chatMessageSchemaRef } from '../../schemas';

export const mentionIdSchemaRef = registerSchemaAsRef(
  'mentionId',
  'Mention ID',
  Type.Object(
    {
      // Object Definition
      mentionId: customType.UUID(),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const minimalChatMentionSchemaRef = registerSchemaAsRef(
  'minimalChatMention',
  'Minimal Chat Mention',
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      account: accountSchemaRef,
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
      status: Type.Enum(MentionStatus),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const completeChatMentionSchemaRef = registerSchemaAsRef(
  'completeChatMention',
  'Complete Chat Mention',
  Type.Intersect(
    [
      minimalChatMentionSchemaRef,
      Type.Object({
        message: chatMessageSchemaRef,
      }),
    ],
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const updateChatMentionSchemaRef = registerSchemaAsRef(
  'updateChatMention',
  'Update Chat Mention',
  Type.Object(
    {
      // Object Definition
      status: Type.Enum(MentionStatus),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

/**
 * JSON schema on GET mentions route for request and response
 */
export const getMentions = {
  response: {
    [StatusCodes.OK]: Type.Array(completeChatMentionSchemaRef),
  },
} as const satisfies FastifySchema;

/**
 * JSON schema on PATCH mention route for request and response
 */
export const patchMention = {
  params: mentionIdSchemaRef,
  body: updateChatMentionSchemaRef,
  response: {
    [StatusCodes.OK]: minimalChatMentionSchemaRef,
  },
} as const satisfies FastifySchema;

/**
 * JSON schema on DELETE remove mention route for request and response
 */
export const deleteMention = {
  params: mentionIdSchemaRef,
  response: {
    [StatusCodes.OK]: minimalChatMentionSchemaRef,
  },
} as const satisfies FastifySchema;

/**
 * JSON schema on DELETE clear all mentions route for request and response
 */
export const clearAllMentions = {
  response: {
    [StatusCodes.OK]: Type.Array(completeChatMentionSchemaRef),
  },
} as const satisfies FastifySchema;
