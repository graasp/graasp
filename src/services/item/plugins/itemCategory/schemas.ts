export default {
  $id: 'https://graasp.org/categories/',
  definitions: {
    category: {
      type: 'object',
      properties: {
        id: {
          $ref: 'https://graasp.org/#/definitions/uuid',
        },
        name: { type: 'string' },
        type: {
          $ref: 'https://graasp.org/#/definitions/uuid',
        },
      },
      additionalProperties: false,
    },
    itemCategory: {
      type: 'object',
      properties: {
        id: {
          $ref: 'https://graasp.org/#/definitions/uuid',
        },
        category: {
          $ref: 'https://graasp.org/categories/#/definitions/category',
        },
        createdAt: {},
        item: {
          $ref: 'https://graasp.org/items/#/definitions/item',
        },
        creator: {
          $ref: 'https://graasp.org/members/#/definitions/member',
        },
      },
      additionalProperties: false,
    },
    itemIdParam: {
      type: 'object',
      required: ['itemId'],
      properties: {
        itemId: { $ref: 'https://graasp.org/#/definitions/uuid' },
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
  params: { $ref: 'https://graasp.org/categories/#/definitions/itemIdParam' },
  response: {
    200: {
      type: 'array',
      items: {
        $ref: 'https://graasp.org/categories/#/definitions/itemCategory',
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
        items: { $ref: 'https://graasp.org/#/definitions/uuid' },
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'https://graasp.org/categories/#/definitions/category' },
    },
  },
};

export const getCategory = {
  params: {
    type: 'object',
    properties: {
      categoryId: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  response: {
    200: { $ref: 'https://graasp.org/categories/#/definitions/category' },
  },
};

export const getCategoryTypes = {
  response: {
    200: {
      type: 'array',
      items: {
        $ref: 'https://graasp.org/categories/#/definitions/categoryType',
      },
    },
  },
};

export const create = {
  params: { $ref: 'https://graasp.org/categories/#/definitions/itemIdParam' },
  body: {
    type: 'object',
    properties: {
      categoryId: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
  },
  response: {
    200: { $ref: 'https://graasp.org/categories/#/definitions/itemCategory' },
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
          $ref: 'https://graasp.org/categories/#/definitions/concatenatedIds',
        },
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'array',
      items: {
        $ref: 'https://graasp.org/items/#/definitions/item',
      },
    },
  },
};

export const deleteOne = {
  params: {
    type: 'object',
    required: ['itemId', 'itemCategoryId'],
    properties: {
      itemId: { $ref: 'https://graasp.org/#/definitions/uuid' },
      itemCategoryId: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  response: {
    200: { $ref: 'https://graasp.org/#/definitions/uuid' },
  },
};

export const createCategory = {
  body: {
    type: 'object',
    required: ['name', 'type'],
    properties: {
      name: { type: 'string' },
      type: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
  },
  response: {
    200: { $ref: 'https://graasp.org/categories/#/definitions/category' },
  },
};

export const deleteById = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
};
