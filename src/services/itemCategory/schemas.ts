export default {
  $id: 'http://graasp.org/categories/',
  definitions: {
    category: {
      type: 'object',
      properties: {
        id: {
          $ref: 'http://graasp.org/#/definitions/uuid',
        },
        name: { type: 'string' },
        type: {
          $ref: 'http://graasp.org/#/definitions/uuid',
        },
      },
      additionalProperties: false,
    },
    categoryType: {
      type: 'object',
      properties: {
        id: {
          $ref: 'http://graasp.org/#/definitions/uuid',
        },
        name: { type: 'string' },
      },
      additionalProperties: false,
    },
    itemCategory: {
      type: 'object',
      properties: {
        id: {
          $ref: 'http://graasp.org/#/definitions/uuid',
        },
        category: {
          $ref: 'http://graasp.org/categories/#/definitions/category',
        },
        createdAt: {},
      },
      additionalProperties: false,
    },
    itemIdParam: {
      type: 'object',
      required: ['itemId'],
      properties: {
        itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
      },
      additionalProperties: false,
    },
    // item properties to be returned to the client
    item: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: ['string', 'null'] },
        type: { type: 'string' },
        path: { type: 'string' },
        extra: {
          type: 'object',
          additionalProperties: true,
        },
        creator: { type: 'string' },
        createdAt: {},
        updatedAt: {},
        settings: {},
      },
      additionalProperties: false,
    },
    concatenatedIds: {
      type: 'string',
      pattern:
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' +
        '(,[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})*$',
    },
  },
};

export const getItemCategories = {
  params: { $ref: 'http://graasp.org/categories/#/definitions/itemIdParam' },
  response: {
    200: {
      type: 'array',
      items: {
        $ref: 'http://graasp.org/categories/#/definitions/itemCategory',
      },
    },
  },
};

export const getCategories = {
  querystring: {
    type: 'object',
    properties: {
      typeId: {
        type: 'array',
        items: { $ref: 'http://graasp.org/#/definitions/uuid' },
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/categories/#/definitions/category' },
    },
  },
};

export const getCategory = {
  params: {
    type: 'object',
    properties: {
      categoryId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  response: {
    200: { $ref: 'http://graasp.org/categories/#/definitions/category' },
  },
};

export const getCategoryTypes = {
  response: {
    200: {
      type: 'array',
      items: {
        $ref: 'http://graasp.org/categories/#/definitions/categoryType',
      },
    },
  },
};

export const create = {
  params: { $ref: 'http://graasp.org/categories/#/definitions/itemIdParam' },
  body: {
    type: 'object',
    properties: {
      categoryId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
  },
  response: {
    200: { $ref: 'http://graasp.org/categories/#/definitions/itemCategory' },
  },
};

export const getByCategories = {
  querystring: {
    type: 'object',
    required: ['categoryId'],
    properties: {
      categoryId: {
        type: 'array',
        items: {
          $ref: 'http://graasp.org/categories/#/definitions/concatenatedIds',
        },
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/categories/#/definitions/item' },
    },
  },
};

export const deleteOne = {
  params: {
    type: 'object',
    required: ['itemId', 'itemCategoryId'],
    properties: {
      itemId: { $ref: 'http://graasp.org/#/definitions/uuid' },
      itemCategoryId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  response: {
    200: { $ref: 'http://graasp.org/#/definitions/uuid' },
  },
};

export const createCategoryType = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
    },
  },
  response: {
    200: { $ref: 'http://graasp.org/categories/#/definitions/categoryType' },
  },
};

export const createCategory = {
  body: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      name: { type: 'string' },
      type: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
  },
  response: {
    200: { $ref: 'http://graasp.org/categories/#/definitions/category' },
  },
};

export const deleteById = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
};
