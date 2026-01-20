import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { accountTypeGuestRef, accountTypeIndividualRef } from '../account/account.schemas';
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

const memberSchema = customType.StrictObject(
  {
    id: customType.UUID(),
    name: customType.Username(),
    email: Type.String({ format: 'email' }),
  },
  {
    description: 'Member sharable information',
  },
);

export const memberSchemaRef = registerSchemaAsRef('member', 'Member', memberSchema);

export const nullableMemberSchemaRef = registerSchemaAsRef(
  'nullableMember',
  'Nullable Member',
  customType.Nullable(memberSchema),
);

const currentAccountSchema = customType.StrictObject({
  id: customType.UUID(),
  name: customType.Username(),
  createdAt: customType.DateTime(),
  updatedAt: customType.DateTime(),
  lang: Type.String(),
  // for legacy issue we support null
  // but on login last authenticatedAt should always be updated
  lastAuthenticatedAt: Type.Union([Type.Null(), customType.DateTime()]),
});

const compositeCurrentMemberSchema = Type.Composite([
  currentAccountSchema, // Base properties from minimal current account
  customType.StrictObject(
    {
      email: Type.Optional(Type.String({ format: 'email' })),
      type: accountTypeIndividualRef,
      isValidated: Type.Boolean(),
      userAgreementsDate: Type.Union([Type.Null(), customType.DateTime()]),
      enableSaveActions: Type.Boolean(),
      extra: Type.Object({}, { additionalProperties: true }),
    },
    { description: 'Current member information' },
  ),
]);

const compositeCurrentGuestSchema = Type.Composite([
  currentAccountSchema, // Base properties from minimal current account
  customType.StrictObject(
    {
      type: accountTypeGuestRef,
      itemLoginSchema: Type.Object({
        item: Type.Object({
          id: customType.UUID(),
          name: Type.String(),
          path: Type.String(),
        }),
      }),
    },
    { description: 'Current guest information' },
  ),
]);

export const currentAccountSchemaRef = registerSchemaAsRef(
  'currentAccount',
  'Current Account',
  Type.Union(
    [
      // The current account can either be an individual or a guest
      compositeCurrentMemberSchema,
      compositeCurrentGuestSchema,
    ],
    {
      discriminator: { propertyName: 'type' },
      description: 'Current authenticated account, that can be a member or a guest',
    },
  ),
);

export const nullableCurrentAccountSchemaRef = registerSchemaAsRef(
  'nullableCurrentAccount',
  'Nullable Current Account',
  Type.Union(
    [
      // The current account can either be an individual or a guest
      customType.Nullable(compositeCurrentMemberSchema),
      customType.Nullable(compositeCurrentGuestSchema),
    ],
    {
      discriminator: { propertyName: 'type' },
      description: 'Current authenticated account, that can be a member or a guest, or null',
    },
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

export const getCurrent = {
  operationId: 'getCurrentAccount',
  tags: ['current', 'member', 'guest'],
  summary: 'Get information of current authenticated account',
  description: 'Get information of current authenticated account, that can be a member or a guest.',

  response: {
    [StatusCodes.OK]: nullableCurrentAccountSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for getting current member's storage limits
export const getStorage = {
  operationId: 'getStorage',
  tags: ['current', 'member', 'storage'],
  summary: 'Get storage values',
  description: 'Get amount of storage used for current member, and its maximum storage value.',

  response: {
    [StatusCodes.OK]: customType.StrictObject(
      {
        current: Type.Integer({
          description: 'Current amount of storage used',
        }),
        maximum: Type.Integer({
          description: 'Maximum amount of storage available',
        }),
      },
      { description: 'Successful Response' },
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getStorageFiles = {
  operationId: 'getStorageFiles',
  tags: ['current', 'member', 'storage'],
  summary: 'Get storage files data',
  description: 'Get files data counted in storage of current member.',

  querystring: customType.Pagination({
    page: Type.Integer({
      minimum: FILE_METADATA_MIN_PAGE,
      default: FILE_METADATA_MIN_PAGE,
    }),
    pageSize: Type.Integer({ default: FILE_METADATA_DEFAULT_PAGE_SIZE }),
  }),
  response: {
    [StatusCodes.OK]: customType.StrictObject(
      {
        data: Type.Array(fileItemMetadata),
        pagination: customType.Pagination({
          page: {
            minimum: FILE_METADATA_MIN_PAGE,
            default: FILE_METADATA_MIN_PAGE,
          },
          pageSize: { default: FILE_METADATA_DEFAULT_PAGE_SIZE },
        }),
      },
      { description: 'Successful Response' },
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

// schema for getting a member
export const getOne = {
  operationId: 'getOneMember',
  tags: ['member'],
  summary: 'Get member by id',
  description: 'Get member by id.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: memberSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateCurrent = {
  operationId: 'updateCurrentAccount',
  tags: ['member', 'guest'],
  summary: 'Update authenticated account',
  description: 'Update authenticated account, such as name or language.',

  body: customType.StrictObject(
    {
      name: Type.Optional(customType.Username()),
      enableSaveActions: Type.Optional(Type.Boolean()),
      extra: Type.Optional(Type.Object({}, { additionalProperties: true })),
    },
    { minProperties: 1 },
  ),
  response: {
    [StatusCodes.OK]: currentAccountSchemaRef,
    [StatusCodes.FORBIDDEN]: errorSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteCurrent = {
  operationId: 'deleteCurrentAccount',
  tags: ['member', 'guest'],
  summary: 'Delete authenticated account',
  description: 'Delete authenticated account. This action is irreversible!',

  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const postChangeEmail = {
  operationId: 'postChangeEmail',
  tags: ['member', 'email'],
  summary: 'Request to change email',
  description: 'Request to change email for current authenticated member.',

  body: customType.StrictObject({ email: Type.String({ format: 'email' }) }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    [StatusCodes.CONFLICT]: errorSchemaRef,
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const patchChangeEmail = {
  operationId: 'patchChangeEmail',
  tags: ['member', 'email'],
  summary: 'Change email',
  description: 'Change email for current authenticated member.',

  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    [StatusCodes.CONFLICT]: errorSchemaRef,
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const emailSubscribe = {
  operationId: 'emailSubscribe',
  tags: ['member', 'email'],
  summary: 'Subscribe to newsletter emails',
  description: 'Subscribe to newsletter emails for current authenticated member.',

  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const emailUnsubscribe = {
  operationId: 'emailUnsubscribe',
  tags: ['member', 'email'],
  summary: 'Unsubscribe from newsletter emails',
  description: 'Unsubscribe from newsletter emails for current authenticated member.',
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
    '5xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
