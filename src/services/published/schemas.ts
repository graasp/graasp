import { MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

// TODO: refactor
const item = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    type: { type: 'string' },
    path: { type: 'string' },
    extra: {
      type: 'object',
      additionalProperties: true,
    },
    creator: { type: 'string' },
    createdAt: {},
    updatedAt: {},
    settings: {},
  },
  additionalProperties: false,
};

const publishEntry = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    item,
    creator: {
      $ref: 'http://graasp.org/members/#/definitions/member',
    },
    createdAt: {},
  },
  additionalProperties: false,
};

// the query string from frontend is in the form of ['A1,A2', 'B1', 'C1,C2,C3']
// where A, B, C denote different category types, and 1, 2 denote different categories within same type
// intersection between index
// union in strings
const concatenatedIds = {
  type: 'string',
  pattern:
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' +
    '(,[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})*$',
};

export const getCollections = {
  querystring: {
    type: 'object',
    properties: {
      categoryId: {
        type: 'array',
        items: concatenatedIds,
        maxItems: MAX_TARGETS_FOR_READ_REQUEST,
      },
    },
  },

  response: {
    200: {
      type: 'array',
      items: item,
    },
  },
};

export const publishItem = {
  params: {
    type: 'object',
    properties: {
      itemId: {
        $ref: 'http://graasp.org/#/definitions/uuid',
      },
    },
  },

  response: {
    200: publishEntry,
  },
};

export const unpublishItem = {
  params: {
    type: 'object',
    properties: {
      itemId: {
        $ref: 'http://graasp.org/#/definitions/uuid',
      },
    },
  },

  response: {
    200: publishEntry,
  },
};
