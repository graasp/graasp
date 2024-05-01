import { Action, ActionTriggers, Context, DiscriminatedItem, PermissionLevel } from '@graasp/sdk';

import { CannotModifyOtherMembers, UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { ActionService } from '../../../action/services/action';
import { validatePermissionMany } from '../../../authorization';
import { Actor } from '../../entities/member';

export const getMonthBeforeNow = () => {
  const date = new Date(); // Today's date
  date.setMonth(date.getMonth() - 1); // Set the date to one month ago
  return date;
};

type ReducedActionBasedOnPermission = {
  actionsNeedsPermission: Action[];
  actionsWithoutPermssion: Action[];
  setOfItemsToCheckPermission: DiscriminatedItem[];
};

const actionTypesWithoutNeedOfPermission = [
  ActionTriggers.CollectionView,
  ActionTriggers.ItemLike,
  ActionTriggers.ItemUnlike,
  ActionTriggers.ItemDownload,
  ActionTriggers.ItemEmbed,
  ActionTriggers.ItemSearch,
  ActionTriggers.MemberLogin,
];

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

    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const data = await actionRepository.getForMember(actor.id, {
      startDate: start,
      endDate: end,
    });

    const { actionsNeedsPermission, actionsWithoutPermssion, setOfItemsToCheckPermission } =
      data.reduce(
        (acc: ReducedActionBasedOnPermission, ele) => {
          if (ele.type === ActionTriggers.Copy && ele.view === Context.Library) {
            acc.actionsWithoutPermssion.push(ele);
          } else if (actionTypesWithoutNeedOfPermission.indexOf(ele.type as ActionTriggers) > -1) {
            acc.actionsWithoutPermssion.push(ele);
          } else {
            acc.actionsNeedsPermission.push(ele);

            if (ele.item && !acc.setOfItemsToCheckPermission.find((m) => m.id === ele?.item?.id)) {
              acc.setOfItemsToCheckPermission.push(ele.item);
            }
          }
          return acc;
        },
        {
          actionsNeedsPermission: [],
          actionsWithoutPermssion: [],
          setOfItemsToCheckPermission: [],
        },
      );

    const memberships = await validatePermissionMany(
      repositories,
      PermissionLevel.Read,
      actor,
      setOfItemsToCheckPermission,
    );

    const filteredActionsWithAccessPermission = actionsNeedsPermission.filter((g) => {
      if (g.item && g?.item?.id in memberships.data) {
        return true;
      }
      return null;
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
