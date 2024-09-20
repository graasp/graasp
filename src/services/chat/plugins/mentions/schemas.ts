/**
 * JSON schema definitions to validate requests and responses
 * through Fastify's AJV instance
 */
import { MentionStatus } from '@graasp/sdk';

import { accountSchemaRef } from '../../../account/schemas';

export default {
  $id: 'https://graasp.org/mentions/',
  definitions: {
    memberIdParam: {
      type: 'object',
      required: ['memberId'],
      properties: {
        memberId: { $ref: 'https://graasp.org/#/definitions/uuid' },
      },
    },

    mentionParam: {
      type: 'object',
      required: ['mentionId'],
      properties: {
        mentionId: { $ref: 'https://graasp.org/#/definitions/uuid' },
      },
    },

    memberMentions: {
      type: 'array',
      items: { $ref: '#/definitions/chatMention' },
      additionalProperties: false,
    },

    chatMention: {
      type: 'object',
      properties: {
        id: { $ref: 'https://graasp.org/#/definitions/uuid' },
        message: { $ref: 'https://graasp.org/chat/#/definitions/chatMessage' },
        account: accountSchemaRef,
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        status: {
          type: 'string',
          enum: Object.values(MentionStatus),
        },
      },
      additionalProperties: false,
    },

    // chat mention properties required for update
    partialChatMention: {
      type: 'object',
      required: ['status'],
      properties: {
        status: {
          type: 'string',
          enum: Object.values(MentionStatus),
        },
      },
      additionalProperties: false,
    },
  },
};

/**
 * JSON schema on GET mentions route for request and response
 */
const getMentions = {
  response: {
    200: { $ref: 'https://graasp.org/mentions/#/definitions/memberMentions' },
  },
};

/**
 * JSON schema on PATCH mention route for request and response
 */
const patchMention = {
  params: { $ref: 'https://graasp.org/mentions/#/definitions/mentionParam' },
  body: { $ref: 'https://graasp.org/mentions/#/definitions/partialChatMention' },
  response: {
    200: { $ref: 'https://graasp.org/mentions/#/definitions/chatMention' },
  },
};

/**
 * JSON schema on DELETE remove mention route for request and response
 */
const deleteMention = {
  params: { $ref: 'https://graasp.org/mentions/#/definitions/mentionParam' },
  response: {
    200: { $ref: 'https://graasp.org/mentions/#/definitions/chatMention' },
  },
};

/**
 * JSON schema on DELETE clear all mentions route for request and response
 */
const clearAllMentions = {
  response: {
    200: { $ref: 'https://graasp.org/mentions/#/definitions/memberMentions' },
  },
};

export { getMentions, patchMention, deleteMention, clearAllMentions };
