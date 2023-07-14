import { MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

import { UUID_REGEX } from '../../../../schemas/global';
import {
  GET_MOST_LIKED_ITEMS_MAXIMUM,
  GET_MOST_RECENT_ITEMS_MAXIMUM,
} from '../../../../utils/config';

const publishEntry = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    item: {
      $ref: 'http://graasp.org/items/#/definitions/item',
    },
    creator: {
      $ref: 'http://graasp.org/members/#/definitions/member',
    },
    createdAt: { type: 'string' },
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
      items: {
        $ref: 'http://graasp.org/items/#/definitions/item',
      },
    },
  },
};

export const getRecentCollections = {
  querystring: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        maximum: GET_MOST_RECENT_ITEMS_MAXIMUM,
        minimum: 1,
      },
    },
  },

  response: {
    200: {
      type: 'array',
      items: publishEntry,
    },
  },
};

export const getMostLikedItems = {
  querystring: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        maximum: GET_MOST_LIKED_ITEMS_MAXIMUM,
        minimum: 1,
      },
    },
  },

  response: {
    200: {
      type: 'array',
      items: {
        $ref: 'http://graasp.org/items/#/definitions/item',
      },
    },
  },
};

export const getCollectionsForMember = {
  params: {
    type: 'object',
    properties: {
      memberId: {
        $ref: 'http://graasp.org/#/definitions/uuid',
      },
    },
    required: ['memberId'],
  },

  response: {
    200: {
      type: 'array',
      items: {
        $ref: 'http://graasp.org/items/#/definitions/item',
      },
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
    required: ['itemId'],
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
    required: ['itemId'],
  },

  response: {
    200: publishEntry,
  },
};

export const getInformations = {
  params: {
    type: 'object',
    properties: {
      itemId: {
        $ref: 'http://graasp.org/#/definitions/uuid',
      },
    },
    required: ['itemId'],
  },

  response: {
    200: publishEntry,
  },
};

export const getManyInformations = {
  querystring: {
    allOf: [
      {
        type: 'object',
        required: ['itemId'],
        properties: {
          itemId: {
            type: 'array',
            items: {
              $ref: 'http://graasp.org/#/definitions/uuid',
            },
            uniqueItems: true,
          },
        },
        additionalProperties: false,
      },
      {
        type: 'object',
        properties: { itemId: { type: 'array', maxItems: MAX_TARGETS_FOR_READ_REQUEST } },
      },
    ],
  },

  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          patternProperties: {
            [UUID_REGEX]: publishEntry,
          },
        },
        errors: {
          type: 'array',
          items: {
            $ref: 'http://graasp.org/#/definitions/error',
          },
        },
      },
    },
  },
};
