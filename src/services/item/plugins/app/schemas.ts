import { customType } from '../../../../plugins/typebox';
import { itemIdSchemaRef } from '../itemLike/schemas';

export default {
  $id: 'https://graasp.org/apps/',
  definitions: {
    appContext: {
      type: 'object',
      properties: {
        item: { $ref: 'https://graasp.org/items/#/definitions/item' },
        members: {
          type: 'array',
          items: {
            $ref: 'https://graasp.org/members/#/definitions/member',
          },
        },
      },
    },
  },
};

const generateToken = {
  params: itemIdSchemaRef,
  body: {
    type: 'object',
    required: ['key', 'origin'],
    properties: {
      key: customType.UUID(),
      origin: { type: 'string', format: 'url' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: { token: { type: 'string' } },
    },
  },
};

const getContext = {
  params: itemIdSchemaRef,
  response: {
    200: { $ref: 'https://graasp.org/apps/#/definitions/appContext' },
  },
};
const patchSettings = {
  params: itemIdSchemaRef,
  body: {
    type: 'object',
    additionalProperties: true,
  },
  response: {
    204: {},
  },
};

export { generateToken, getContext, patchSettings };
