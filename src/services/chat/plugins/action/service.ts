import { singleton } from 'tsyringe';

import { FastifyRequest } from 'fastify';

import { UUID } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { ActionService } from '../../../action/services/action';
import { ChatMessage } from '../../chatMessage';

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

  async postPostMessageAction(
    request: FastifyRequest,
    repositories: Repositories,
    message: ChatMessage,
  ) {
    const { user } = request;
    const action = {
      item: message.item,
      type: ChatActionType.Create,
      extra: { ...(request.body as { body: string; mentions: string[] }) },
    };
    await this.actionService.postMany(user?.account, repositories, request, [action]);
  }

  async postPatchMessageAction(
    request: FastifyRequest,
    repositories: Repositories,
    message: ChatMessage,
  ) {
    const { user } = request;
    const action = {
      item: message.item,
      type: ChatActionType.Update,
      extra: { ...(request.body as { body: string }), messageId: message.id },
    };
    await this.actionService.postMany(user?.account, repositories, request, [action]);
  }

  async postDeleteMessageAction(
    request: FastifyRequest,
    repositories: Repositories,
    message: ChatMessage,
  ) {
    const { user } = request;
    const action = {
      item: message.item,
      type: ChatActionType.Delete,
      extra: { messageId: message.id },
    };
    await this.actionService.postMany(user?.account, repositories, request, [action]);
  }

  async postClearMessageAction(request: FastifyRequest, repositories: Repositories, itemId: UUID) {
    const { user } = request;
    const action = {
      type: ChatActionType.Clear,
      extra: { itemId },
    };
    await this.actionService.postMany(user?.account, repositories, request, [action]);
  }
}
