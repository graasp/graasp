const upload = {
  querystring: {
    type: 'object',
    properties: {
      id: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
};

const download = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
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
