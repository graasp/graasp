import { customType } from '../../../../../../../plugins/typebox';
import { entityIdSchemaRef } from '../../../../../../../schemas/global';

const upload = {
  querystring: {
    type: 'object',
    properties: {
      id: customType.UUID(),
    },
    additionalProperties: false,
  },
};

const download = {
  params: entityIdSchemaRef,
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
