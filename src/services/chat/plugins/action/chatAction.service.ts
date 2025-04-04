import { singleton } from 'tsyringe';

import { FastifyRequest } from 'fastify';

import { Context, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { ChatMessageRaw } from '../../../../drizzle/types';
import { ActionService } from '../../../action/action.service';

enum ChatActionType {
  Create = 'chat_create',
  Update = 'chat_update',
  Delete = 'chat_delete',
  Clear = 'chat_clear',
}

@singleton()
export class ActionChatService {
  private readonly actionService: ActionService;

  constructor(actionService: ActionService) {
    this.actionService = actionService;
  }

  async postPostMessageAction(db: DBConnection, request: FastifyRequest, message: ChatMessageRaw) {
    const { user } = request;
    const action = {
      itemId: message.itemId,
      type: ChatActionType.Create,
      extra: JSON.stringify({
        ...(request.body as { body: string; mentions: string[] }),
      }),
      // FIX: add view from which the action was created
      // view: ??
    };

    await this.actionService.postMany(db, user?.account, request, [action]);
  }

  async postPatchMessageAction(db: DBConnection, request: FastifyRequest, message: ChatMessageRaw) {
    const { user } = request;
    const action = {
      itemId: message.itemId,
      type: ChatActionType.Update,
      extra: JSON.stringify({
        ...(request.body as { body: string }),
        messageId: message.id,
      }),
      // FIX: add view from which the action was created
      // view: ??
    };
    await this.actionService.postMany(db, user?.account, request, [action]);
  }

  async postDeleteMessageAction(
    db: DBConnection,
    request: FastifyRequest,
    message: ChatMessageRaw,
  ) {
    const { user } = request;
    const action = {
      itemId: message.itemId,
      type: ChatActionType.Delete,
      extra: JSON.stringify({ messageId: message.id }),
      // FIX: add view from which the action was created
      // view: ??
    };
    await this.actionService.postMany(db, user?.account, request, [action]);
  }

  async postClearMessageAction(db: DBConnection, request: FastifyRequest, itemId: UUID) {
    const { user } = request;
    const action = {
      type: ChatActionType.Clear,
      extra: JSON.stringify({ itemId }),
      view: Context.Builder,
    };
    await this.actionService.postMany(db, user?.account, request, [action]);
  }
}
