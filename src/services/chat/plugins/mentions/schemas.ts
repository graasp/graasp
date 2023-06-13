/**
 * JSON schema definitions to validate requests and responses
 * through Fastify's AJV instance
 */
import { MentionStatus } from '@graasp/sdk';

export default {
  $id: 'http://graasp.org/mentions/',
  definitions: {
    memberIdParam: {
      type: 'object',
      required: ['memberId'],
      properties: {
        memberId: { $ref: 'http://graasp.org/#/definitions/uuid' },
      },
    },

    mentionParam: {
      type: 'object',
      required: ['mentionId'],
      properties: {
        mentionId: { $ref: 'http://graasp.org/#/definitions/uuid' },
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
        id: { $ref: 'http://graasp.org/#/definitions/uuid' },
        message: { $ref: 'http://graasp.org/chat/#/definitions/chatMessage' },
        member: { $ref: 'http://graasp.org/members/#/definitions/member' },
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
    200: { $ref: 'http://graasp.org/mentions/#/definitions/memberMentions' },
  },
};

/**
 * JSON schema on PATCH mention route for request and response
 */
const patchMention = {
  params: { $ref: 'http://graasp.org/mentions/#/definitions/mentionParam' },
  body: { $ref: 'http://graasp.org/mentions/#/definitions/partialChatMention' },
  response: {
    200: { $ref: 'http://graasp.org/mentions/#/definitions/chatMention' },
  },
};

/**
 * JSON schema on DELETE remove mention route for request and response
 */
const deleteMention = {
  params: { $ref: 'http://graasp.org/mentions/#/definitions/mentionParam' },
  response: {
    200: { $ref: 'http://graasp.org/mentions/#/definitions/chatMention' },
  },
};

/**
 * JSON schema on DELETE clear all mentions route for request and response
 */
const clearAllMentions = {
  response: {
    200: { $ref: 'http://graasp.org/mentions/#/definitions/memberMentions' },
  },
};

export { getMentions, patchMention, deleteMention, clearAllMentions };
