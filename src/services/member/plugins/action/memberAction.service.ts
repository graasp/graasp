import partition from 'lodash.partition';
import { singleton } from 'tsyringe';

import { ActionTriggers } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import type { ItemRaw } from '../../../../drizzle/types';
import type { AuthenticatedUser } from '../../../../types';
import { CannotModifyOtherMembers } from '../../../../utils/errors';
import { ActionRepository } from '../../../action/action.repository';
import { ActionService } from '../../../action/action.service';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import type { ActionDateFilters } from '../../../item/plugins/action/itemAction.repository';

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
  private readonly actionRepository: ActionRepository;
  private readonly authorizedItemService: AuthorizedItemService;

  constructor(
    actionService: ActionService,
    actionRepository: ActionRepository,
    authorizedItemService: AuthorizedItemService,
  ) {
    this.actionService = actionService;
    this.authorizedItemService = authorizedItemService;
    this.actionRepository = actionRepository;
  }

  async getFilteredActions(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    filters: ActionDateFilters,
  ) {
    const { startDate, endDate } = filters;
    const start = startDate ? new Date(startDate) : getPreviousMonthFromNow();
    const end = endDate ? new Date(endDate) : new Date();

    const actions = await this.actionRepository.getAccountActions(
      dbConnection,
      authenticatedUser.id,
      {
        startDate: start,
        endDate: end,
      },
    );

    // filter actions based on permission validity
    const [actionsWithoutPermission, actionsNeedPermission] = partition(actions, (action) => {
      return actionTypesWithoutNeedOfPermission.includes(action.type);
    });

    const setOfItemsToCheckPermission = Array.from(
      new Map(actionsNeedPermission.map(({ item }) => [item?.id, item])).values(),
    ).filter(Boolean);

    const { itemMemberships } = await this.authorizedItemService.getPropertiesForItems(
      dbConnection,
      {
        permission: 'read',
        accountId: authenticatedUser.id,
        items: setOfItemsToCheckPermission as ItemRaw[],
      },
    );

    const filteredActionsWithAccessPermission = actionsNeedPermission.filter((g) => {
      return g.item && g?.item?.id in itemMemberships.data;
    });
    return [...actionsWithoutPermission, ...filteredActionsWithAccessPermission];
  }

  async deleteAllForMember(
    dbConnection: DBConnection,
    authenticatedUser: AuthenticatedUser,
    memberId: string,
  ): Promise<void> {
    if (authenticatedUser?.id !== memberId) {
      throw new CannotModifyOtherMembers({ id: memberId });
    }

    await this.actionRepository.deleteAllForAccount(dbConnection, memberId);
  }
}
