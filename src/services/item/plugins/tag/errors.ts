import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { FAILURE_MESSAGES } from '@graasp/sdk';

export const ItemTagAlreadyExists = createError(
  'GITERR001',
  FAILURE_MESSAGES.ITEM_TAG_ALREADY_EXISTS,
  StatusCodes.CONFLICT,
);
