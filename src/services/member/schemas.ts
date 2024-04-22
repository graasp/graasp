import {
  MAX_TARGETS_FOR_READ_REQUEST,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
} from '@graasp/sdk';

import { UUID_REGEX } from '../../schemas/global';

const EMAIL_REGEX = '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$';

export default {
  $id: 'https://graasp.org/members/',
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
        userAgreementsDate: { type: 'string' },
        enableSaveActions: { type: 'boolean' },
        extra: { type: 'object', additionalProperties: true },
      },
      additionalProperties: false,
    },

    // member properties that can be modified with user input
    partialMember: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          minLength: MIN_USERNAME_LENGTH,
          maxLength: MAX_USERNAME_LENGTH,
          pattern: '^\\S+( \\S+)*$',
        },
        extra: { type: 'object', additionalProperties: true },
        enableSaveActions: { type: 'boolean' },
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
            { type: 'object', required: ['enableSaveActions'] },
          ],
        },
      ],
    },
  },
};

// schema for getting current member
export const getCurrent = {
  response: {
    200: { $ref: 'https://graasp.org/members/#/definitions/currentMember' },
  },
};

// schema for getting current member's storage limits
export const getStorage = {
  response: {
    200: {
      type: 'object',
      properties: {
        current: {
          type: 'number',
        },
        maximum: {
          type: 'number',
        },
      },
      additionalProperties: false,
      require: ['current', 'maximum'],
    },
  },
};

// schema for getting a member
export const getOne = {
  params: { $ref: 'https://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'https://graasp.org/members/#/definitions/member' },
  },
};

// schema for getting >1 members
export const getMany = {
  querystring: {
    allOf: [
      { $ref: 'https://graasp.org/#/definitions/idsQuery' },
      {
        type: 'object',
        properties: { id: { type: 'array', maxItems: MAX_TARGETS_FOR_READ_REQUEST } },
      },
    ],
  },
  response: {
    200: {
      type: 'object',
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
            $ref: 'https://graasp.org/#/definitions/error',
          },
        },
      },
    },
  },
};

// schema for getting members by
export const getManyBy = {
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
            $ref: 'https://graasp.org/#/definitions/error',
          },
        },
      },
    },
  },
};

// schema for updating own member
export const updateOne = {
  params: { $ref: 'https://graasp.org/#/definitions/idParam' },
  body: { $ref: 'https://graasp.org/members/#/definitions/partialMemberRequireOne' },
  response: {
    200: { $ref: 'https://graasp.org/members/#/definitions/currentMember' },
  },
};

// schema for getting a member
export const deleteOne = {
  params: { $ref: 'https://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'https://graasp.org/members/#/definitions/member' },
  },
};
