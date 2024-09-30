import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import {
  MAX_TARGETS_FOR_READ_REQUEST,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
} from '@graasp/sdk';

import { customType } from '../../plugins/typebox';
import { error } from '../../schemas/fluent-schema';
import { UUID_REGEX, entityIdSchemaRef, errorSchemaRef } from '../../schemas/global';
import { FILE_METADATA_DEFAULT_PAGE_SIZE, FILE_METADATA_MIN_PAGE } from './constants';

/**
 * This allows email adresses that are structured as follows:
 * - at least one of
 *   - word character
 *   - dash
 *   - dot
 * - the @ symbol
 * - multiple times
 *   - at least one of
 *     - word cahracter
 *     - dash
 *   - a dot
 * - a tld extension that is between 2 and 63 chars long
 *
 * The maximum length of the TLD is defined by https://www.rfc-editor.org/rfc/rfc1034
 * and is 63 octets (chars)
 *
 */
export const EMAIL_REGEX = '^[.-\\w]+@[.-\\w]+.[-\\w]{2,63}$';

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
        lastAuthenticatedAt: { type: 'string' },
        isValidated: { type: 'boolean' },
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
          format: 'username',
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
export const getCurrent: FastifySchema = {
  response: {
    200: { $ref: 'https://graasp.org/members/#/definitions/currentMember' },
  },
};

// schema for getting current member's storage limits
export const getStorage: FastifySchema = {
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

export const getStorageFiles: FastifySchema = {
  querystring: {
    type: 'object',
    properties: {
      page: { type: 'number', default: FILE_METADATA_MIN_PAGE },
      pageSize: { type: 'number', default: FILE_METADATA_DEFAULT_PAGE_SIZE },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              size: { type: 'number' },
              updatedAt: { type: 'string' },
              path: { type: 'string' },
              parent: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        totalCount: { type: 'number' },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            pageSize: { type: 'number' },
          },
        },
      },
    },
    '4xx': error,
  },
};

// schema for getting a member
export const getOne: FastifySchema = {
  params: entityIdSchemaRef,
  response: {
    200: { $ref: 'https://graasp.org/members/#/definitions/member' },
  },
};

// schema for getting >1 members
export const getMany: FastifySchema = {
  querystring: Type.Object({
    id: Type.Array(customType.UUID(), {
      uniqueItems: true,
      minItems: 1,
      maxItems: MAX_TARGETS_FOR_READ_REQUEST,
    }),
  }),

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
        errors: Type.Array(errorSchemaRef),
      },
    },
  },
};

// schema for getting members by
export const getManyBy: FastifySchema = {
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
        errors: Type.Array(errorSchemaRef),
      },
    },
  },
};

// schema for updating a member
export const updateOne: FastifySchema = {
  deprecated: true,
  params: entityIdSchemaRef,
  body: { $ref: 'https://graasp.org/members/#/definitions/partialMemberRequireOne' },
  response: {
    [StatusCodes.OK]: { $ref: 'https://graasp.org/members/#/definitions/currentMember' },
    [StatusCodes.FORBIDDEN]: error,
  },
};

// schema for updating the current member
export const updateCurrent: FastifySchema = {
  body: { $ref: 'https://graasp.org/members/#/definitions/partialMemberRequireOne' },
  response: {
    [StatusCodes.OK]: { $ref: 'https://graasp.org/members/#/definitions/currentMember' },
    [StatusCodes.FORBIDDEN]: error,
  },
};

// schema for deleting a member
export const deleteOne: FastifySchema = {
  params: entityIdSchemaRef,
  response: {
    [StatusCodes.NO_CONTENT]: {},
  },
};

// schema for deleting the current member
export const deleteCurrent: FastifySchema = {
  response: {
    [StatusCodes.NO_CONTENT]: {},
  },
};

export const postChangeEmail: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
    },
    additionalProperties: false,
  },
  response: {
    [StatusCodes.NO_CONTENT]: {},
    [StatusCodes.CONFLICT]: error,
    [StatusCodes.UNAUTHORIZED]: error,
  },
};

export const patchChangeEmail: FastifySchema = {
  response: {
    [StatusCodes.NO_CONTENT]: {},
    [StatusCodes.CONFLICT]: error,
    [StatusCodes.UNAUTHORIZED]: error,
  },
};
