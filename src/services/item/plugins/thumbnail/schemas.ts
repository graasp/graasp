import { ThumbnailSize } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { entityIdSchemaRef } from '../../../../schemas/global';

const upload = {
  params: {
    type: 'object',
    properties: {
      id: customType.UUID(),
    },
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
};

const deleteSchema = {
  params: {
    type: 'object',
    properties: {
      id: customType.UUID(),
    },
    additionalProperties: false,
  },
};

export { upload, download, deleteSchema };
