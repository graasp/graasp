import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';
import { FAILURE_MESSAGES } from '@graasp/sdk';

export const ItemMembershipAlreadyExists = createError(
  'GMRERR001',
  FAILURE_MESSAGES.MEMBERSHIP_ALREADY_EXISTS,
  StatusCodes.BAD_REQUEST,
);

export const MembershipRequestAlreadyExists = createError(
  'GMRERR002',
  FAILURE_MESSAGES.MEMBERSHIP_REQUEST_ALREADY_EXISTS,
  StatusCodes.BAD_REQUEST,
);

export const MembershipRequestNotFound = createError(
  'GMRERR003',
  FAILURE_MESSAGES.MEMBERSHIP_REQUEST_NOT_FOUND,
  StatusCodes.NOT_FOUND,
);
