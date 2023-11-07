export const zipImport = {
  querystring: {
    type: 'object',
    properties: {
      parentId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
};

export const zipExport = {
  params: {
    itemId: {
      $ref: 'http://graasp.org/#/definitions/uuid',
    },
  },
  querystring: {
    type: 'object',

    properties: {
      actionType: {
        type: 'string',
      },
    },
  },
  required: ['itemId'],
  additionalProperties: false,
};
