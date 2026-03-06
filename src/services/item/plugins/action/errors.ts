import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

/**
 * Errors thrown by the action item plugin
 */

export const CannotPostAction = createError('GIAERR003',
  'Cannot post action',
 StatusCodes.FORBIDDEN,
);
