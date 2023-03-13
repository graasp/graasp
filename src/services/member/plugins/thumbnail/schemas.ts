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
      { $ref: 'http://graasp.org/#/definitions/idParam' },
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
