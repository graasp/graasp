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
  Type.Object(
    {
      // Object Definition
      mentionId: customType.UUID(),
    },
    {
      // Schema Options
      title: 'Mention ID',
      $id: 'mentionId',
      additionalProperties: false,
    },
  ),
);

export const minimalChatMentionSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      account: accountSchemaRef,
      createdAt: customType.Date(),
      updatedAt: customType.Date(),
      status: Type.Enum(MentionStatus),
    },
    {
      // Schema Options
      title: 'Minimal Chat Mention',
      $id: 'minimalChatMention',
      additionalProperties: false,
    },
  ),
);

export const completeChatMentionSchemaRef = registerSchemaAsRef(
  Type.Intersect(
    [
      minimalChatMentionSchemaRef,
      Type.Object({
        message: chatMessageSchemaRef,
      }),
    ],
    {
      // Schema Options
      title: 'Complete Chat Mention',
      $id: 'completeChatMention',
      additionalProperties: false,
    },
  ),
);

export const updateChatMentionSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      status: Type.Enum(MentionStatus),
    },
    {
      // Schema Options
      title: 'Update Chat Mention',
      $id: 'updateChatMention',
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
