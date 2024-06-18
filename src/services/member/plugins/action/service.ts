import partition from 'lodash.partition';

import { ActionTriggers, PermissionLevel } from '@graasp/sdk';

import { CannotModifyOtherMembers, UnauthorizedMember } from '../../../../utils/errors.js';
import { Repositories } from '../../../../utils/repositories.js';
import { ActionService } from '../../../action/services/action.js';
import { validatePermissionMany } from '../../../authorization.js';
import { Item, ItemExtraMap } from '../../../item/entities/Item.js';
import { Actor } from '../../entities/member.js';

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
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

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
