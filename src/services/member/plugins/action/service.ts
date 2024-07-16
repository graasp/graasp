import partition from 'lodash.partition';
import { singleton } from 'tsyringe';

import { ActionTriggers, PermissionLevel } from '@graasp/sdk';

import { CannotModifyOtherMembers } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { ActionService } from '../../../action/services/action';
import { validatePermissionMany } from '../../../authorization';
import { Item, ItemExtraMap } from '../../../item/entities/Item';
import { Member } from '../../entities/member';

export const getPreviousMonthFromNow = () => {
  const date = new Date(); // Today's date
  date.setMonth(date.getMonth() - 1); // Set the date to one month ago
  return date;
};

export const actionTypesWithoutNeedOfPermission: string[] = [
  ActionTriggers.CollectionView,
  ActionTriggers.ItemLike,
  ActionTriggers.ItemUnlike,
  ActionTriggers.ItemDownload,
  ActionTriggers.ItemEmbed,
  ActionTriggers.ItemSearch,
  ActionTriggers.MemberLogin,
];

@singleton()
export class ActionMemberService {
  private readonly actionService: ActionService;

  constructor(actionService: ActionService) {
    this.actionService = actionService;
  }

  async getFilteredActions(
    actor: Member,
    repositories: Repositories,
    filters: { startDate?: string; endDate?: string },
  ) {
    const { actionRepository } = repositories;

    const { startDate, endDate } = filters;
    const start = startDate ? new Date(startDate) : getPreviousMonthFromNow();
    const end = endDate ? new Date(endDate) : new Date();

    const actions = await actionRepository.getMemberActions(actor.id, {
      startDate: start,
      endDate: end,
    });

    // filter actions based on permission validity
    const [actionsWithoutPermission, actionsNeedPermission] = partition(actions, (action) => {
      return actionTypesWithoutNeedOfPermission.includes(action.type);
    });

    const setOfItemsToCheckPermission = Array.from(
      new Map(actionsNeedPermission.map(({ item }) => [item?.id, item])).values(),
    ).filter(Boolean);

    const { itemMemberships } = await validatePermissionMany(
      repositories,
      PermissionLevel.Read,
      actor,
      setOfItemsToCheckPermission as Item<keyof ItemExtraMap>[],
    );

    const filteredActionsWithAccessPermission = actionsNeedPermission.filter((g) => {
      return g.item && g?.item?.id in itemMemberships.data;
    });
    return [...actionsWithoutPermission, ...filteredActionsWithAccessPermission];
  }

  async deleteAllForMember(
    actor: Member,
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
