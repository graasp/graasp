import { PermissionLevel } from '@graasp/sdk';

import HookManager from '../../../../utils/hook';
import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import { ChatMessage } from '../../chatMessage';
import { MemberCannotAccessMention } from '../../errors';

export class MentionService {
  hooks = new HookManager();

  async createManyForItem(
    actor,
    repositories: Repositories,
    message: ChatMessage,
    mentionedMembers: string[],
  ) {
    const { mentionRepository, itemRepository } = repositories;

    // check actor has access to item
    const item = await itemRepository.get(message.item.id);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    // TODO: optimize ? suppose same item - validate multiple times
    const results = await mentionRepository.postMany(mentionedMembers, message, item);

    this.hooks.runPostHooks('createMany', actor, repositories, { mentions: results, item });

    return results;
  }

  async getForMember(actor, repositories: Repositories) {
    const { mentionRepository } = repositories;
    return mentionRepository.getForMember(actor.id);
  }

  async get(
    actor,
    repositories: Repositories,
    mentionId: string,
    options = { shouldExist: false },
  ) {
    const { mentionRepository } = repositories;
    const mentionContent = await mentionRepository.get(mentionId, options);

    if (mentionContent.member.id !== actor.id) {
      throw new MemberCannotAccessMention(mentionId);
    }

    return mentionContent;
  }

  async patch(actor, repositories: Repositories, mentionId: string, status) {
    const { mentionRepository } = repositories;

    // check permission
    await this.get(actor, repositories, mentionId, { shouldExist: true });

    return mentionRepository.patch(mentionId, status);
  }

  async deleteOne(actor, repositories: Repositories, mentionId: string) {
    const { mentionRepository } = repositories;

    // check permission
    await this.get(actor, repositories, mentionId, { shouldExist: true });

    return mentionRepository.deleteOne(mentionId);
  }

  async deleteAll(actor, repositories: Repositories) {
    const { mentionRepository } = repositories;
    return mentionRepository.deleteAll(actor.id);
    //     const clearedChat: Chat = { id: this.targetId, messages: [] };
    //     await this.postHookHandler?.(clearedChat, this.actor, { log, handler });
  }
}
