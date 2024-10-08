import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import {
  MAX_TARGETS_FOR_READ_REQUEST,
  MAX_USERNAME_LENGTH,
  MIN_USERNAME_LENGTH,
} from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
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

const memberSchema = Type.Object(
  {
    // Object definition
    id: customType.UUID(),
    name: Type.String({
      format: 'username',
      minLength: MIN_USERNAME_LENGTH,
      maxLength: MAX_USERNAME_LENGTH,
    }),
    email: Type.String({ format: 'email' }),
  },
  {
    // Schema options
    additionalProperties: false,
  },
);

export const memberSchemaRef = registerSchemaAsRef('member', 'Member', memberSchema);

export const nullableMemberSchemaRef = registerSchemaAsRef(
  'nullableMember',
  'Nullable Member',
  customType.Nullable(memberSchema),
);

export const currentMemberSchemaRef = registerSchemaAsRef(
  'currentMember',
  'Current Member',
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      name: Type.String({
        format: 'username',
        minLength: MIN_USERNAME_LENGTH,
        maxLength: MAX_USERNAME_LENGTH,
      }),
      email: Type.String({ format: 'email' }),
      type: Type.String(),
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
      lastAuthenticatedAt: customType.DateTime(),
      isValidated: Type.Boolean(),
      userAgreementsDate: customType.DateTime(),
      enableSaveActions: Type.Boolean(),
      extra: Type.Object({}, { additionalProperties: true }),
    },
    {
      // Schema options
      additionalProperties: false,
    },
  ),
);

export const updateMemberRequiredOneSchemaRef = registerSchemaAsRef(
  'updateMemberRequiredOne',
  'Update Member Required One',
  Type.Object(
    {
      // Object definition
      name: Type.Optional(
        Type.String({
          format: 'username',
          minLength: MIN_USERNAME_LENGTH,
          maxLength: MAX_USERNAME_LENGTH,
        }),
      ),
      enableSaveActions: Type.Optional(Type.Boolean()),
      extra: Type.Optional(Type.Object({}, { additionalProperties: true })),
    },
    { additionalProperties: false, minProperties: 1 },
  ),
);

// schema for getting current member
export const getCurrent: FastifySchema = {
  response: {
    [StatusCodes.OK]: currentMemberSchemaRef,
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
    [StatusCodes.OK]: memberSchemaRef,
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
  body: updateMemberRequiredOneSchemaRef,
  response: {
    [StatusCodes.OK]: currentMemberSchemaRef,
    [StatusCodes.FORBIDDEN]: error,
  },
};

// schema for updating the current member
export const updateCurrent: FastifySchema = {
  body: updateMemberRequiredOneSchemaRef,
  response: {
    [StatusCodes.OK]: currentMemberSchemaRef,
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
