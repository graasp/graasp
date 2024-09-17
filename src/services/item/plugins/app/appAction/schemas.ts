export default {
  $id: 'https://graasp.org/apps/app-action/',
  definitions: {
    appAction: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        account: { $ref: 'https://graasp.org/accounts/#/definitions/account' },
        /** @deprecated use account */
        member: { $ref: 'https://graasp.org/accounts/#/definitions/account' },
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
  params: { $ref: 'https://graasp.org/apps/#/definitions/itemIdParam' },
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
  params: { $ref: 'https://graasp.org/apps/#/definitions/itemIdParam' },
  querystring: {
    type: 'object',
    properties: {
      /** @deprecated use accountId */
      memberId: { $ref: 'https://graasp.org/#/definitions/uuid' },
      accountId: { $ref: 'https://graasp.org/#/definitions/uuid' },
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
