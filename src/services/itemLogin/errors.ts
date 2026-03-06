import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { FAILURE_MESSAGES } from '@graasp/sdk';

export const MemberIdentifierNotFound = createError(
  'GILERR002',
  'Member identifier not found',
  StatusCodes.NOT_FOUND,
);

export const InvalidMember = createError(
  'GILERR003',
  'This member cannot be used to login to an item',
  StatusCodes.NOT_FOUND,
);

export const MissingItemLoginSchema = createError(
  'GILERR004',
  'Missing login schema',
  StatusCodes.INTERNAL_SERVER_ERROR,
);

export const MissingItemLoginTag = createError(
  'GILERR005',
  'Item does not possess the required visibility',
  StatusCodes.BAD_REQUEST,
);

export const ValidMemberSession = createError(
  'GILERR006',
  'Member with valid session trying to (re)login',
  StatusCodes.BAD_REQUEST,
);

export const InvalidCredentials = createError(
  'GILERR007',
  "Provided credentials don't match member's",
  StatusCodes.UNAUTHORIZED,
);

export const MissingCredentialsForLoginSchema = createError(
  'GILERR008',
  'Missing credentials for set login schema',
  StatusCodes.BAD_REQUEST,
);

export const UnnecessaryCredentialsForLoginSchema = createError(
  'GILERR008',
  'Unnecessary credentials for set login schema',
  StatusCodes.BAD_REQUEST,
);

export const ItemLoginSchemaNotFound = createError(
  'GILERR009',
  'Item login schema not found for item',
  StatusCodes.NOT_FOUND,
);

export const CannotNestItemLoginSchema = createError(
  'GILERR010',
  'Item login schema already item exists in an ancestor',
  StatusCodes.FORBIDDEN,
);

export const NotGuest = createError(
  'GILERR011',
  FAILURE_MESSAGES.NOT_A_GUEST,
  StatusCodes.FORBIDDEN,
);

export const ItemLoginSchemaExists = createError(
  'GILERR012',
  FAILURE_MESSAGES.CANNOT_CREATE_MEMBERSHIP_CAUSE_ITEM_LOGIN_SCHEMA_EXISTS,
  StatusCodes.CONFLICT,
);

export const CannotEnrollItemWithoutItemLoginSchema = createError(
  'GILERR013',
  FAILURE_MESSAGES.CANNOT_ENROLL_ITEM_WITHOUT_ITEM_LOGIN_SCHEMA,
  StatusCodes.FORBIDDEN,
);

export const CannotRegisterOnFrozenItemLoginSchema = createError(
  'GILERR014',
  FAILURE_MESSAGES.CANNOT_REGISTER_ON_FROZEN_ITEM_LOGIN_SCHEMA,
  StatusCodes.FORBIDDEN,
);

export const CannotEnrollFrozenItemLoginSchema = createError(
  'GILERR015',
  FAILURE_MESSAGES.CANNOT_ENROLL_FROZEN_ITEM_LOGIN_SCHEMA,
  StatusCodes.FORBIDDEN,
);

export const GuestNotFound = createError('GILERR016', 'GUEST_NOT_FOUND', StatusCodes.NOT_FOUND);
