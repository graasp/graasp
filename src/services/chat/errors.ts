import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { ErrorFactory } from '@graasp/sdk';

const PLUGIN_NAME = 'graasp-plugin-chatbox';

/**
 * Errors thrown by the chat tasks
 */

export const GraaspChatboxError = ErrorFactory(PLUGIN_NAME);

export class ChatMessageNotFound extends GraaspChatboxError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GICERR003',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Chat Message not found',
      },
      data,
    );
  }
}

export class MemberCannotEditMessage extends GraaspChatboxError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GICERR002',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Member can only edit own messages',
      },
      data,
    );
  }
}

export class MemberCannotDeleteMessage extends GraaspChatboxError {
  constructor(data: { id: string }) {
    super(
      {
        code: 'GICERR005',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Member can only delete own messages',
      },
      data.id,
    );
  }
}

export class MemberCannotAccessMention extends GraaspChatboxError {
  constructor(data: { id: string }) {
    super(
      {
        code: 'GICERR004',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Member can only view own mentions',
      },
      data.id,
    );
  }
}

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
