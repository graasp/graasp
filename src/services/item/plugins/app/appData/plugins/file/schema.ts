import { customType } from '../../../../../../../plugins/typebox';

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
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
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
