import { MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

const UUID_REGEX = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

const EMAIL_REGEX = '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$';

export default {
  $id: 'http://graasp.org/members/',
  definitions: {
    member: {
      type: 'object',
      nullable: true,
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
          anyOf: [
            { type: 'object', required: ['name'] },
            { type: 'object', required: ['extra'] },
          ],
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
      {
        type: 'object',
        properties: { id: { type: 'array', maxItems: MAX_TARGETS_FOR_READ_REQUEST } },
      },
    ],
  },
  response: {
    200: {
      type: 'object',
      // additionalProperties:true,
      properties: {
        data: {
          type: 'object',
          patternProperties: {
            [UUID_REGEX]: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
              },
            },
          },
        },
        errors: {
          type: 'array',
          items: {
            $ref: 'http://graasp.org/#/definitions/error',
          },
        },
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
      type: 'object',
      // additionalProperties:true,
      properties: {
        data: {
          type: 'object',
          patternProperties: {
            [EMAIL_REGEX]: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
              },
            },
          },
        },
        errors: {
          type: 'array',
          items: {
            $ref: 'http://graasp.org/#/definitions/error',
          },
        },
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
