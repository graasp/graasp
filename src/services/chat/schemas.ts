/**
 * JSON schema definitions to validate requests and responses
 * through Fastify's AJV instance
 */
export default {
  $id: 'https://graasp.org/chat/',
  definitions: {
    itemIdParam: {
      type: 'object',
      required: ['itemId'],
      properties: {
        itemId: { $ref: 'https://graasp.org/#/definitions/uuid' },
      },
    },

    messageParam: {
      type: 'object',
      required: ['itemId', 'messageId'],
      properties: {
        itemId: { $ref: 'https://graasp.org/#/definitions/uuid' },
        messageId: { $ref: 'https://graasp.org/#/definitions/uuid' },
      },
    },

    chat: {
      type: 'object',
      properties: {
        id: { $ref: 'https://graasp.org/#/definitions/uuid' },
        messages: {
          type: 'array',
          items: { $ref: '#/definitions/chatMessage' },
        },
      },
    },

    chatMessage: {
      type: 'object',
      properties: {
        id: { $ref: 'https://graasp.org/#/definitions/uuid' },
        creator: { $ref: 'https://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        body: { type: 'string' },
        item: {
          $ref: 'https://graasp.org/items/#/definitions/item',
        },
      },
      additionalProperties: false,
    },

    // chat message properties required at creation
    partialChatMessage: {
      type: 'object',
      required: ['body'],
      properties: {
        body: {
          type: 'string',
        },
        mentions: {
          type: 'array',
          items: {
            type: 'string',
          },
          minItems: 0,
        },
      },
      additionalProperties: false,
    },
  },
};

/**
 * JSON schema on GET chat route for request and response
 */
const getChat = {
  params: { $ref: 'https://graasp.org/chat/#/definitions/itemIdParam' },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'https://graasp.org/chat/#/definitions/chatMessage' },
    },
  },
};

/**
 * JSON schema on POST publish message route for request and response
 */
const publishMessage = {
  params: { $ref: 'https://graasp.org/chat/#/definitions/itemIdParam' },
  body: { $ref: 'https://graasp.org/chat/#/definitions/partialChatMessage' },
  response: {
    201: { $ref: 'https://graasp.org/chat/#/definitions/chatMessage' },
  },
};

/**
 * JSON schema on PATCH message route for request and response
 */
const patchMessage = {
  params: { $ref: 'https://graasp.org/chat/#/definitions/messageParam' },
  body: {
    type: 'object',
    required: ['body'],
    properties: {
      body: { type: 'string' },
    },
  },
  response: {
    200: { $ref: 'https://graasp.org/chat/#/definitions/chatMessage' },
  },
};

/**
 * JSON schema on DELETE remove message route for request and response
 */
const deleteMessage = {
  params: { $ref: 'https://graasp.org/chat/#/definitions/messageParam' },
  response: {
    200: { $ref: 'https://graasp.org/chat/#/definitions/chatMessage' },
  },
};

/**
 * JSON schema on DELETE clear chat route for request and response
 */
const clearChat = {
  params: { $ref: 'https://graasp.org/chat/#/definitions/itemIdParam' },
  response: {
    200: { $ref: 'https://graasp.org/chat/#/definitions/chat' },
  },
};

export { getChat, publishMessage, patchMessage, deleteMessage, clearChat };
