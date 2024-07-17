import { StatusCodes } from 'http-status-codes';

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
  constructor(data?: unknown) {
    super(
      {
        code: 'GICERR004',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: 'Member can only view own mentions',
      },
      data,
    );
  }
}

export class ChatMentionNotFound extends GraaspChatboxError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GICERR006',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Chat mention not found',
      },
      data,
    );
  }
}

export class NoChatMentionForMember extends GraaspChatboxError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GICERR007',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'This member cannot have chat mention',
      },
      data,
    );
  }
}
