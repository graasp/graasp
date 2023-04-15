import { CannotModifyOtherMembers } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { ActionService } from '../../../action/services/action';
import { Actor } from '../../entities/member';

export class ActionMemberService {
  actionService: ActionService;

  constructor(actionService: ActionService) {
    this.actionService = actionService;
  }

  async deleteAllForMember(
    actor: Actor,
    repositories: Repositories,
    memberId: string,
  ): Promise<void> {
    const { actionRepository } = repositories;

    if (actor?.id !== memberId) {
      throw new CannotModifyOtherMembers(memberId);
    }

    await actionRepository.deleteAllForMember(memberId);
  }
}
