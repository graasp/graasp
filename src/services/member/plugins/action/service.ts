import { partition } from 'lodash';

import { PermissionLevel } from '@graasp/sdk';

import { CannotModifyOtherMembers, UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { actionTypesWithoutNeedOfPermission } from '../../../action/repositories/action';
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

    const actions = await actionRepository.getMemberActions(actor.id, {
      startDate: start,
      endDate: end,
    });

    // filter actions based on permission validity
    const [actionsWithoutPermssion, actionsNeedsPermission] = partition(actions, (action) => {
      return actionTypesWithoutNeedOfPermission.indexOf(action.type) > -1;
    });

    const setOfItemsToCheckPermission = Array.from(
      new Map(actionsNeedsPermission.map(({ item }) => [item?.id, item])).values(),
    ).filter(Boolean);

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
    return [...actionsWithoutPermssion, ...filteredActionsWithAccessPermission];
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
