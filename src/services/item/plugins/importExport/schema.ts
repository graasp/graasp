import { customType } from '../../../../plugins/typebox';

export const zipImport = {
  querystring: {
    type: 'object',
    properties: {
      parentId: customType.UUID(),
    },
    additionalProperties: false,
  },
};

export const zipExport = {
  params: {
    itemId: {
      $ref: 'https://graasp.org/#/definitions/uuid',
    },
  },
  required: ['itemId'],
  additionalProperties: false,
};
