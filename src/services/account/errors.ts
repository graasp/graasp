import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { FAILURE_MESSAGES } from '@graasp/sdk';

export const AccountNotFound = createError(
  'GPAECCRR001',
  FAILURE_MESSAGES.ACCOUNT_NOT_FOUND,
  StatusCodes.NOT_FOUND,
);

export const NotMemberOrGuest = createError(
  'GPAECCRR002',
  FAILURE_MESSAGES.NOT_MEMBER_OR_GUEST,
  StatusCodes.FORBIDDEN,
);
