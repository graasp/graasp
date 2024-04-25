import { ActionTriggers } from '@graasp/sdk';

import { CannotModifyOtherMembers, UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { ActionService } from '../../../action/services/action';
import { ItemActionType } from '../../../item/plugins/action/utils';
import { Actor } from '../../entities/member';

export const getMonthBeforeNow = () => {
  const date = new Date(); // Today's date
  date.setMonth(date.getMonth() - 1); // Set the date to one month ago
  return date;
};

export class ActionMemberService {
  actionService: ActionService;

  constructor(actionService: ActionService) {
    this.actionService = actionService;
  }

  async getFilteredActions(
    actor: Actor,
    repositories: Repositories,
    filters: { startDate?: string; endDate?: string },
  ) {
    const { actionRepository } = repositories;

    const { startDate, endDate } = filters;
    const start = startDate ? new Date(startDate) : getMonthBeforeNow();
    const end = endDate ? new Date(endDate) : new Date();

    const allowedTypes = [
      ActionTriggers.MemberLogin,
      ItemActionType.Create,
      ItemActionType.Update,
      ItemActionType.Delete,
    ];

    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const data = await actionRepository.getForMember(actor.id, {
      startDate: start,
      endDate: end,
      allowedTypes,
    });

    return data;
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
