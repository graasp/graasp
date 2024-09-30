import { StatusCodes } from 'http-status-codes';

import { ThumbnailSize } from '@graasp/sdk';

import { entityIdSchemaRef, errorSchemaRef } from '../../../../schemas/global';

const upload = {
  params: {
    type: 'object',
    additionalProperties: false,
  },
};

const download = {
  params: {
    allOf: [
      entityIdSchemaRef,
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
    [StatusCodes.OK]: errorSchemaRef,
    '4xx': errorSchemaRef,
    [StatusCodes.INTERNAL_SERVER_ERROR]: errorSchemaRef,
  },
};

export { upload, download };
