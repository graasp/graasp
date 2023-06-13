import { Ranges } from './types';

const search = {
  params: {
    keyword: {
      type: 'string',
    },
    range: {
      type: 'string',
      enum: Object.values(Ranges),
    },
  },
  query: {
    type: 'object',
    properties: {
      keywords: { type: 'string' },
      tags: {
        type: 'array',
        items: { type: 'string' },
      },
      parentId: { type: 'string' },
      name: { type: 'string' },
      creator: { type: 'string' },
    },
  },
  required: ['range', 'keyword'],
  response: {
    200: {
      type: 'array',
      items: {
        $ref: 'http://graasp.org/items/#/definitions/item',
      },
    },
  },
};

export { search };
