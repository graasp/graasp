import { customType } from '../../../../../plugins/typebox';
import { accountSchemaRef } from '../../../../account/schemas';
import { itemIdSchemaRef } from '../../itemLike/schemas';

export default {
  $id: 'https://graasp.org/apps/app-action/',
  definitions: {
    appAction: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        account: accountSchemaRef,
        /** @deprecated use account */
        member: { $ref: accountSchemaRef.$ref, deprecated: true },
        item: {
          $ref: 'https://graasp.org/items/#/definitions/item',
        },
        data: {},
        type: { type: 'string' },
        createdAt: { type: 'string' },
      },
    },
  },
};

const create = {
  params: itemIdSchemaRef,
  body: {
    type: 'object',
    required: ['data', 'type'],
    properties: {
      data: { type: 'object', additionalProperties: true },
      type: { type: 'string', minLength: 3, maxLength: 25 },
    },
  },
  response: {
    200: { $ref: 'https://graasp.org/apps/app-action/#/definitions/appAction' },
  },
};

const getForOne = {
  params: itemIdSchemaRef,
  querystring: {
    type: 'object',
    properties: {
      /** @deprecated use accountId */
      memberId: customType.UUID({ deprecated: true }),
      accountId: customType.UUID(),
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'https://graasp.org/apps/app-action/#/definitions/appAction' },
    },
  },
};

export { create, getForOne };
