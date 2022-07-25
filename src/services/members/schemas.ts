import { MAX_TARGETS_FOR_READ_REQUEST } from '../../util/config';

export default {
  $id: 'http://graasp.org/members/',
  definitions: {
    member: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
      },
      additionalProperties: false,
    },

    currentMember: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
        type: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        extra: { type: 'object', additionalProperties: true },
      },
      additionalProperties: false,
    },

    // member properties that can be modified with user input
    partialMember: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, pattern: '^\\S+( \\S+)*$' },
        extra: { type: 'object', additionalProperties: true },
      },
      additionalProperties: false,
    },

    // partialMember requiring one property to be defined
    partialMemberRequireOne: {
      allOf: [
        { $ref: '#/definitions/partialMember' },
        {
          anyOf: [{ required: ['name'] }, { required: ['extra'] }],
        },
      ],
    },
  },
};

// schema for getting current member
const getCurrent = {
  response: {
    200: { $ref: 'http://graasp.org/members/#/definitions/currentMember' },
  },
};

// schema for getting a member
const getOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'http://graasp.org/members/#/definitions/member' },
  },
};

// schema for getting >1 members
const getMany = {
  querystring: {
    allOf: [
      { $ref: 'http://graasp.org/#/definitions/idsQuery' },
      { properties: { id: { maxItems: MAX_TARGETS_FOR_READ_REQUEST } } },
    ],
  },
  response: {
    200: {
      type: 'array',
      items: {
        anyOf: [
          {
            $ref: 'http://graasp.org/#/definitions/error',
          },
          // additionalproperties=false would prevent this schema to apply
          {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' },
            },
          },
        ],
      },
    },
  },
};

// schema for getting members by
const getManyBy = {
  querystring: {
    type: 'object',
    properties: {
      email: {
        type: 'array',
        items: { type: 'string', format: 'email' },
      },
      additionalProperties: false,
    },
  },
  response: {
    200: {
      type: 'array',
      items: {
        type: 'array',
        items: { $ref: 'http://graasp.org/members/#/definitions/member' },
      },
    },
  },
};

// schema for updating a member
const updateOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  body: { $ref: 'http://graasp.org/members/#/definitions/partialMemberRequireOne' },
  response: {
    200: { $ref: 'http://graasp.org/members/#/definitions/member' },
  },
};

// schema for getting a member
const deleteOne = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'http://graasp.org/members/#/definitions/member' },
  },
};

export { getCurrent, getOne, getMany, updateOne, getManyBy, deleteOne };
