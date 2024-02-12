import { ThumbnailSize } from '@graasp/sdk';

const upload = {
  params: {
    type: 'object',
    additionalProperties: false,
  },
};

const download = {
  params: {
    allOf: [
      { $ref: 'https://graasp.org/#/definitions/idParam' },
      {
        type: 'object',
        properties: {
          size: {
            enum: Object.values(ThumbnailSize),
            default: ThumbnailSize.Medium,
          },
        },
        required: ['size'],
      },
    ],
  },
  querystring: {
    type: 'object',
    properties: {
      replyUrl: {
        type: 'boolean',
        default: false,
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'string',
    },
    '4xx': {
      $ref: 'https://graasp.org/#/definitions/error',
    },
    500: {
      $ref: 'https://graasp.org/#/definitions/error',
    },
  },
};

export { upload, download };
