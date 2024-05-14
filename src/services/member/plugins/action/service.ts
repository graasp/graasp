import { PermissionLevel } from '@graasp/sdk';

import { CannotModifyOtherMembers, UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { ActionService } from '../../../action/services/action';
import { validatePermissionMany } from '../../../authorization';
import { Item, ItemExtraMap } from '../../../item/entities/Item';
import { Actor } from '../../entities/member';

export const getPreviousMonthFromNow = () => {
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
    const start = startDate ? new Date(startDate) : getPreviousMonthFromNow();
    const end = endDate ? new Date(endDate) : new Date();

    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const [actionsNeedsPermission, actionsWithoutPermssion] = await Promise.all([
      actionRepository.getMemberActionsNeedPesrmission(actor.id, {
        startDate: start,
        endDate: end,
      }),
      actionRepository.getMemberActionsNoNeedForPesrmission(actor.id, {
        startDate: start,
        endDate: end,
      }),
    ]);

    const setOfItemsToCheckPermission = Array.from(
      new Map(actionsNeedsPermission.map(({ item }) => [item?.id, item])).values(),
    );

    const { itemMemberships } = await validatePermissionMany(
      repositories,
      PermissionLevel.Read,
      actor,
      setOfItemsToCheckPermission as Item<keyof ItemExtraMap>[],
    );

    const filteredActionsWithAccessPermission = actionsNeedsPermission.filter((g) => {
      if (g.item && g?.item?.id in itemMemberships.data) {
        return true;
      }
      return false;
    });
    return [...filteredActionsWithAccessPermission, ...actionsWithoutPermssion];
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
