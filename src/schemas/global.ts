// we need this file used in classic json schema
// duplicate of shared fluent-schema.ts

export const UUID_REGEX =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

export default {
  $id: 'http://graasp.org/',
  definitions: {
    uuid: {
      type: 'string',
      pattern: UUID_REGEX,
    },
    itemPath: {
      type: 'string',
      pattern:
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' +
        '(.[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})*$',
    },
    idParam: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { $ref: '#/definitions/uuid' },
      },
      additionalProperties: false,
    },
    idsQuery: {
      type: 'object',
      required: ['id'],
      properties: {
        id: {
          type: 'array',
          items: { $ref: '#/definitions/uuid' },
          uniqueItems: true,
        },
      },
      additionalProperties: false,
    },
    error: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        code: { type: 'string' },
        message: { type: 'string' },
        statusCode: { type: 'number' },
        data: {},
        origin: { type: 'string' },
        // stack: {}
      },
      additionalProperties: false,
    },
  },
};
