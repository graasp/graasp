export const zipImport = {
  querystring: {
    type: 'object',
    properties: {
      parentId: { $ref: 'https://graasp.org/#/definitions/uuid' },
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
