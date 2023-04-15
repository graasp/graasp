import { FastifyReply } from 'fastify';

import { UUID } from '@graasp/sdk';

import { buildRepositories } from '../../../../utils/repositories';
import { ActionService } from '../../../action/services/action';
import { ChatMessage } from '../../chatMessage';

enum ChatActionType {
  Create = 'chat_create',
  Update = 'chat_update',
  Delete = 'chat_delete',
  Clear = 'chat_clear',
}

export class ActionChatService {
  actionService: ActionService;

  constructor(actionService: ActionService) {
    this.actionService = actionService;
  }

  async postPostMessageAction(request, reply: FastifyReply, message: ChatMessage) {
    const { member } = request;
    const action = {
      item: message.item,
      type: ChatActionType.Create,
      extra: { ...request.payload },
    };
    await this.actionService.postMany(member, buildRepositories(), request, [action]);
  }

  async postPatchMessageAction(request, reply: FastifyReply, message: ChatMessage) {
    const { member } = request;
    const action = {
      item: message.item,
      type: ChatActionType.Update,
      extra: { ...request.payload, messageId: message.id },
    };
    await this.actionService.postMany(member, buildRepositories(), request, [action]);
  }

  async postDeleteMessageAction(request, reply: FastifyReply, message: ChatMessage) {
    const { member } = request;
    const action = {
      item: message.item,
      type: ChatActionType.Delete,
      extra: { ...request.payload, messageId: message.id },
    };
    await this.actionService.postMany(member, buildRepositories(), request, [action]);
  }

  async postClearMessageAction(request, reply: FastifyReply, itemId: UUID) {
    const { member } = request;
    const action = {
      type: ChatActionType.Clear,
      extra: { itemId },
    };
    await this.actionService.postMany(member, buildRepositories(), request, [action]);
  }
}
