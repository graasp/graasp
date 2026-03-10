import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';
import { FAILURE_MESSAGES } from '@graasp/sdk';

export const MemberProfileNotFound = createError(
  'GMPERR001',
  FAILURE_MESSAGES.MEMBER_PROFILE_NOT_FOUND,
  StatusCodes.NOT_FOUND,
);

export const MemberProfileCreationError = createError(
  'GMPERR002',
  'Could not create member profile. This is an internal server error',
  StatusCodes.INTERNAL_SERVER_ERROR,
);

export const MemberProfilePropertiesEmpty = createError(
  'GMPERR003',
  'All properties of the member profile are empty',
  StatusCodes.BAD_REQUEST,
);
