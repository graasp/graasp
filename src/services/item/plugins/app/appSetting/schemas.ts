export default {
  $id: 'http://graasp.org/apps/app-settings/',
  definitions: {
    appSetting: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        item: { type: 'string' },
        data: {},
        creator: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  },
};

const create = {
  params: { $ref: 'http://graasp.org/apps/#/definitions/itemIdParam' },
  body: {
    type: 'object',
    required: ['data', 'name'],
    properties: {
      data: { type: 'object', additionalProperties: true },
      name: { type: 'string' },
    },
  },
  response: {
    200: { $ref: 'http://graasp.org/apps/app-settings/#/definitions/appSetting' },
  },
};

const updateOne = {
  params: {
    allOf: [
      { $ref: 'http://graasp.org/apps/#/definitions/itemIdParam' },
      { $ref: 'http://graasp.org/#/definitions/idParam' },
    ],
  },
  body: {
    type: 'object',
    required: ['data'],
    properties: {
      data: { type: 'object', additionalProperties: true },
    },
  },
  response: {
    200: { $ref: 'http://graasp.org/apps/app-settings/#/definitions/appSetting' },
  },
};

const deleteOne = {
  params: {
    allOf: [
      { $ref: 'http://graasp.org/apps/#/definitions/itemIdParam' },
      { $ref: 'http://graasp.org/#/definitions/idParam' },
    ],
  },
  response: {
    200: { $ref: 'http://graasp.org/apps/app-settings/#/definitions/appSetting' },
  },
};

const getForOne = {
  params: { $ref: 'http://graasp.org/apps/#/definitions/itemIdParam' },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/apps/app-settings/#/definitions/appSetting' },
    },
  },
};

export { create, updateOne, deleteOne, getForOne };
