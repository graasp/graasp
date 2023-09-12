import { Ranges } from './types';

const search = {
  query: {
    type: 'object',
    properties: {
      queries: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            indexUid: { type: 'string' },
            attributesToHighlight: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            attributesToCrop: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            cropLength: { type: 'number' },
            q: { type: 'string' },
            limit: { type: 'number' },
            sort: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            filter: { type: 'string' },
            highlightPreTag: { type: 'string' },
            highlightPostTag: { type: 'string' },
          },
          required: ['indexUid'],
        },
      },
    },
  },
  response: {},
};

export { search };
