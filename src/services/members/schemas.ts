export default {
  $id: 'http://graasp.org/members/',
  definitions: {
    member: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        // type: { type: 'string' },
      },
      additionalProperties: false
    },
    partialMember: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        type: {
          type: 'string',
          enum: ['individual', 'group']
        }
      },
      additionalProperties: false
    }
  }
};

// schema for getting a member
const getOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'http://graasp.org/members/#/definitions/member' }
  }
};

// schema for getting members by
const getBy = {
  querystring: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' }
    },
    additionalProperties: false
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/members/#/definitions/member' }
    }
  }
};

// schema for creating a member
const create = {
  body: {
    allOf: [
      { $ref: 'http://graasp.org/members/#/definitions/partialMember' },
      { required: ['name', 'email'] }
    ]
  },
  response: {
    200: { $ref: 'http://graasp.org/members/#/definitions/member' }
  }
};

export {
  getOne,
  create,
  getBy
};
