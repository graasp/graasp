import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';
import { FAILURE_MESSAGES } from '@graasp/sdk';

export const EmailAlreadyTaken = createError(
  'GMERR001',
  FAILURE_MESSAGES.EMAIL_ALREADY_TAKEN,
  StatusCodes.CONFLICT,
);

export const NotValidatedMember = createError(
  'GMERR002',
  FAILURE_MESSAGES.NOT_VALIDATED_MEMBER,
  StatusCodes.FORBIDDEN,
);

export const NotMember = createError(
  'GMERR003',
  FAILURE_MESSAGES.NOT_A_MEMBER,
  StatusCodes.FORBIDDEN,
);
