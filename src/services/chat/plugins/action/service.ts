import { FastifyReply, FastifyRequest } from 'fastify';

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

  async postPostMessageAction(request: FastifyRequest, reply: FastifyReply, message: ChatMessage) {
    const { member } = request;
    const action = {
      item: message.item,
      type: ChatActionType.Create,
      extra: { ...(request.body as any) },
    };
    await this.actionService.postMany(member, buildRepositories(), request, [action]);
  }

  async postPatchMessageAction(request: FastifyRequest, reply: FastifyReply, message: ChatMessage) {
    const { member } = request;
    const action = {
      item: message.item,
      type: ChatActionType.Update,
      extra: { ...(request.body as any), messageId: message.id },
    };
    await this.actionService.postMany(member, buildRepositories(), request, [action]);
  }

  async postDeleteMessageAction(
    request: FastifyRequest,
    reply: FastifyReply,
    message: ChatMessage,
  ) {
    const { member } = request;
    const action = {
      item: message.item,
      type: ChatActionType.Delete,
      extra: { ...(request.body as any), messageId: message.id },
    };
    await this.actionService.postMany(member, buildRepositories(), request, [action]);
  }

  async postClearMessageAction(request: FastifyRequest, reply: FastifyReply, itemId: UUID) {
    const { member } = request;
    const action = {
      type: ChatActionType.Clear,
      extra: { itemId },
    };
    await this.actionService.postMany(member, buildRepositories(), request, [action]);
  }
}
