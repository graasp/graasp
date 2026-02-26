import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

/**
 * Errors thrown by the chat tasks
 */

export const ChatMessageNotFound = createError(
  'GICERR003',
  'Chat Message not found',
  StatusCodes.NOT_FOUND,
);

export const MemberCannotEditMessage = createError(
  'GICERR002',
  'Member can only edit own messages',
  StatusCodes.UNAUTHORIZED,
);

export const MemberCannotDeleteMessage = createError(
  'GICERR005',
  'Member can only delete own messages',
  StatusCodes.UNAUTHORIZED,
);

export const MemberCannotAccessMention = createError(
  'GICERR004',
  'Member can only view own mentions',
  StatusCodes.UNAUTHORIZED,
);

export const ChatMentionNotFound = createError(
  'GICERR006',
  'Chat mention not found',
  StatusCodes.NOT_FOUND,
);

export const NoChatMentionForMember = createError(
  'GICERR007',
  'This member cannot have chat mention',
  StatusCodes.BAD_REQUEST,
);
