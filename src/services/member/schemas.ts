import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

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
    name: customType.Username(),
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

const currentMemberSchema = Type.Object(
  {
    // Object definition
    id: customType.UUID(),
    name: customType.Username(),
    email: Type.Optional(Type.String({ format: 'email' })),
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
);

export const currentMemberSchemaRef = registerSchemaAsRef(
  'currentMember',
  'Current Member',
  currentMemberSchema,
);

export const nullableCurrentMemberSchemaRef = registerSchemaAsRef(
  'nullableCurrentMember',
  'Nullable Current Member',
  customType.Nullable(currentMemberSchema),
);

export const updateMemberRequiredOneSchemaRef = registerSchemaAsRef(
  'updateMemberRequiredOne',
  'Update Member Required One',
  Type.Object(
    {
      // Object definition
      name: Type.Optional(customType.Username()),
      enableSaveActions: Type.Optional(Type.Boolean()),
      extra: Type.Optional(Type.Object({}, { additionalProperties: true })),
    },
    { additionalProperties: false, minProperties: 1 },
  ),
);

// schema for getting current member
export const getCurrent = {
  response: {
    [StatusCodes.OK]: nullableCurrentMemberSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for getting current member's storage limits
export const getStorage = {
  response: {
    [StatusCodes.OK]: Type.Object(
      {
        current: Type.Integer(),
        maximum: Type.Integer(),
      },
      {
        additionalProperties: false,
      },
    ),
  },
} as const satisfies FastifySchema;

export const getStorageFiles = {
  querystring: Type.Object(
    {
      page: Type.Integer({ minimum: FILE_METADATA_MIN_PAGE, default: FILE_METADATA_MIN_PAGE }),
      pageSize: Type.Integer({ default: FILE_METADATA_DEFAULT_PAGE_SIZE }),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: Type.Object(
      {
        data: Type.Array(
          Type.Object(
            {
              id: customType.UUID(),
              name: Type.String(),
              size: Type.Integer(),
              updatedAt: customType.DateTime(),
              path: Type.String(),
              parent: Type.Optional(
                Type.Object(
                  {
                    id: customType.UUID(),
                    name: Type.String(),
                  },
                  {
                    additionalProperties: false,
                  },
                ),
              ),
            },
            {
              additionalProperties: false,
            },
          ),
        ),
        totalCount: Type.Integer(),
        pagination: Type.Object(
          {
            page: Type.Integer({
              minimum: FILE_METADATA_MIN_PAGE,
              default: FILE_METADATA_MIN_PAGE,
            }),
            pageSize: Type.Integer({ default: FILE_METADATA_DEFAULT_PAGE_SIZE }),
          },
          { additionalProperties: false },
        ),
      },
      { additionalProperties: false },
    ),
    '4xx': error,
  },
} as const satisfies FastifySchema;

// schema for getting a member
export const getOne = {
  params: entityIdSchemaRef,
  response: {
    [StatusCodes.OK]: memberSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for getting >1 members
export const getMany = {
  querystring: Type.Object(
    {
      id: Type.Array(customType.UUID(), {
        uniqueItems: true,
        minItems: 1,
        maxItems: MAX_TARGETS_FOR_READ_REQUEST,
      }),
    },
    { additionalProperties: false },
  ),

  response: {
    [StatusCodes.OK]: Type.Object({
      data: Type.Record(
        Type.String({ pattern: UUID_REGEX }),
        Type.Object({
          id: customType.UUID(),
          name: customType.Username(),
          email: Type.String(),
        }),
      ),
      errors: Type.Array(errorSchemaRef),
    }),
  },
} as const satisfies FastifySchema;

// schema for getting members by
export const getManyBy = {
  querystring: Type.Object(
    { email: Type.Array(Type.String({ format: 'email' }), { uniqueItems: true, minItems: 1 }) },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: Type.Object(
      {
        data: Type.Record(
          Type.String({ pattern: EMAIL_REGEX }),
          Type.Object(
            {
              id: customType.UUID(),
              name: customType.Username(),
              email: Type.String({ format: 'email' }),
            },
            { additionalProperties: false },
          ),
        ),
        errors: Type.Array(errorSchemaRef),
      },
      { additionalProperties: false },
    ),
  },
} as const satisfies FastifySchema;

// schema for updating a member
export const updateOne = {
  deprecated: true,
  params: entityIdSchemaRef,
  body: updateMemberRequiredOneSchemaRef,
  response: {
    [StatusCodes.OK]: currentMemberSchemaRef,
    [StatusCodes.FORBIDDEN]: error,
  },
} as const satisfies FastifySchema;

// schema for updating the current member
export const updateCurrent = {
  body: updateMemberRequiredOneSchemaRef,
  response: {
    [StatusCodes.OK]: currentMemberSchemaRef,
    [StatusCodes.FORBIDDEN]: error,
  },
} as const satisfies FastifySchema;

// schema for deleting a member
export const deleteOne = {
  params: entityIdSchemaRef,
  response: {
    [StatusCodes.NO_CONTENT]: {},
  },
} as const satisfies FastifySchema;

// schema for deleting the current member
export const deleteCurrent = {
  response: {
    [StatusCodes.NO_CONTENT]: {},
  },
} as const satisfies FastifySchema;

export const postChangeEmail = {
  body: Type.Object({ email: Type.String({ format: 'email' }) }, { additionalProperties: false }),
  response: {
    [StatusCodes.NO_CONTENT]: {},
    [StatusCodes.CONFLICT]: error,
    [StatusCodes.UNAUTHORIZED]: error,
  },
} as const satisfies FastifySchema;

export const patchChangeEmail = {
  response: {
    [StatusCodes.NO_CONTENT]: {},
    [StatusCodes.CONFLICT]: error,
    [StatusCodes.UNAUTHORIZED]: error,
  },
} as const satisfies FastifySchema;
