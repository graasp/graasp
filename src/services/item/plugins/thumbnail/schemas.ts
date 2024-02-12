import { ThumbnailSize } from '@graasp/sdk';

const upload = {
  params: {
    type: 'object',
    properties: {
      id: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
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
};

export { upload, download };
