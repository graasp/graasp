import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { AccountType, MAX_TARGETS_FOR_READ_REQUEST } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
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

const currentAccountSchema = Type.Object(
  {
    // Object Definition
    id: customType.UUID(),
    name: customType.Username(),
    createdAt: customType.DateTime(),
    updatedAt: customType.DateTime(),
    // for legacy issue we support null
    // but on login last authenticatedAt should always be updated
    lastAuthenticatedAt: Type.Union([Type.Null(), customType.DateTime()]),
  },
  {
    // Schema Options
    additionalProperties: false,
  },
);

// Current Member
const compositeCurrentMemberSchema = Type.Composite([
  currentAccountSchema, // Base properties from minimal current account
  Type.Object(
    {
      email: Type.Optional(Type.String({ format: 'email' })),
      type: Type.Literal(AccountType.Individual),
      isValidated: Type.Boolean(),
      userAgreementsDate: Type.Union([Type.Null(), customType.DateTime()]),
      enableSaveActions: Type.Boolean(),
      extra: Type.Object({}, { additionalProperties: true }),
    },
    { additionalProperties: false },
  ),
]);
// Current Guest
const compositeCurrentGuestSchema = Type.Composite([
  currentAccountSchema, // Base properties from minimal current account
  Type.Object(
    {
      type: Type.Literal(AccountType.Guest),
      extra: Type.Object({}, { additionalProperties: true }),
    },
    { additionalProperties: false },
  ),
]);

export const currentAccountSchemaRef = registerSchemaAsRef(
  'currentAccountSchemaRef',
  'Current Account',
  Type.Union(
    [
      // The current account can either be an individual or a guest
      compositeCurrentMemberSchema,
      compositeCurrentGuestSchema,
    ],
    {
      discriminator: { propertyName: 'type' },
    },
  ),
);

export const nullableCurrentAccountSchemaRef = registerSchemaAsRef(
  'nullableCurrentAccountSchemaRef',
  'Nullable Current Account',
  Type.Union(
    [
      // The current account can either be an individual or a guest
      customType.Nullable(compositeCurrentMemberSchema),
      customType.Nullable(compositeCurrentGuestSchema),
    ],
    {
      discriminator: { propertyName: 'type' },
    },
  ),
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

export const fileItemMetadata = customType.StrictObject(
  {
    id: customType.UUID(),
    name: Type.String(),
    size: Type.Integer(),
    updatedAt: customType.DateTime(),
    path: Type.String(),
    parent: Type.Optional(
      customType.StrictObject({
        id: customType.UUID(),
        name: Type.String(),
      }),
    ),
  },
  {
    descritpion: 'File metadata information',
  },
);

// schema for getting current member
export const getCurrent = {
  response: {
    [StatusCodes.OK]: nullableCurrentAccountSchemaRef,
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
  querystring: customType.Pagination({
    page: Type.Integer({ minimum: FILE_METADATA_MIN_PAGE, default: FILE_METADATA_MIN_PAGE }),
    pageSize: Type.Integer({ default: FILE_METADATA_DEFAULT_PAGE_SIZE }),
  }),
  response: {
    [StatusCodes.OK]: Type.Object(
      {
        data: Type.Array(fileItemMetadata),
        totalCount: Type.Integer(),
        pagination: customType.Pagination({
          page: {
            minimum: FILE_METADATA_MIN_PAGE,
            default: FILE_METADATA_MIN_PAGE,
          },
          pageSize: { default: FILE_METADATA_DEFAULT_PAGE_SIZE },
        }),
      },
      { additionalProperties: false },
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for getting a member
export const getOne = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
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
        Type.String({ format: 'uuid' }),
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
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: updateMemberRequiredOneSchemaRef,
  response: {
    [StatusCodes.OK]: currentAccountSchemaRef,
    [StatusCodes.FORBIDDEN]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for updating the current member
export const updateCurrent = {
  body: updateMemberRequiredOneSchemaRef,
  response: {
    [StatusCodes.OK]: currentAccountSchemaRef,
    [StatusCodes.FORBIDDEN]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for deleting a member
export const deleteOne = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: {},
  },
} as const satisfies FastifySchema;

// schema for deleting the current member
export const deleteCurrent = {
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
  },
} as const satisfies FastifySchema;

export const postChangeEmail = {
  body: Type.Object({ email: Type.String({ format: 'email' }) }, { additionalProperties: false }),
  response: {
    [StatusCodes.NO_CONTENT]: {},
    [StatusCodes.CONFLICT]: errorSchemaRef,
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const patchChangeEmail = {
  response: {
    [StatusCodes.NO_CONTENT]: {},
    [StatusCodes.CONFLICT]: errorSchemaRef,
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
  },
} as const satisfies FastifySchema;
