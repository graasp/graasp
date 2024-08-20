import { PermissionLevel } from '@graasp/sdk';

import HookManager from '../../../../../utils/hook';
import { Repositories } from '../../../../../utils/repositories';
import { Account } from '../../../../account/entities/account';
import { validatePermission } from '../../../../authorization';
import { ManyItemsGetFilter, SingleItemGetFilter } from '../interfaces/request';
import { AppAction } from './appAction';
import { AppActionNotAccessible } from './errors';
import { InputAppAction } from './interfaces/app-action';

export class AppActionService {
  hooks = new HookManager<{
    post: {
      pre: { appAction: Partial<InputAppAction>; itemId: string };
      post: { appAction: AppAction; itemId: string };
    };
  }>();
  async post(
    account: Account,
    repositories: Repositories,
    itemId: string,
    body: Partial<InputAppAction>,
  ) {
    const { appActionRepository, itemRepository } = repositories;

    // check item exists? let post fail?
    const item = await itemRepository.getOneOrThrow(itemId);

    // posting an app action is allowed to readers
    await validatePermission(repositories, PermissionLevel.Read, account, item);

    await this.hooks.runPreHooks('post', account, repositories, { appAction: body, itemId });

    const appAction = await appActionRepository.addOne({
      itemId,
      accountId: account.id,
      appAction: body,
    });
    await this.hooks.runPostHooks('post', account, repositories, {
      appAction,
      itemId,
    });
    return appAction;
  }

  async getForItem(
    account: Account,
    repositories: Repositories,
    itemId: string,
    filters: SingleItemGetFilter,
  ) {
    const { appActionRepository, itemRepository } = repositories;

    // check item exists
    const item = await itemRepository.getOneOrThrow(itemId);

    // posting an app action is allowed to readers
    const { itemMembership } = await validatePermission(
      repositories,
      PermissionLevel.Read,
      account,
      item,
    );
    const permission = itemMembership?.permission;
    let { accountId: fMemberId } = filters;

    // can read only own app action if not admin
    if (permission !== PermissionLevel.Admin) {
      if (!fMemberId) {
        fMemberId = account.id;
      } else if (fMemberId !== account.id) {
        throw new AppActionNotAccessible();
      }
    }

    return appActionRepository.getForItem(itemId, { accountId: fMemberId });
  }

  async getForManyItems(
    account: Account,
    repositories: Repositories,
    itemIds: string[],
    filters: ManyItemsGetFilter,
  ) {
    const { appActionRepository, itemRepository } = repositories;

    // check item exists
    const item = await itemRepository.getOneOrThrow(itemIds[0]);

    // posting an app action is allowed to readers
    const { itemMembership } = await validatePermission(
      repositories,
      PermissionLevel.Read,
      account,
      item,
    );
    const permission = itemMembership?.permission;
    const { accountId: fMemberId } = filters;

    // can read only own app action if not admin
    if (permission !== PermissionLevel.Admin) {
      if (fMemberId && fMemberId !== account.id) {
        throw new AppActionNotAccessible();
      }
    }

    // TODO: get only memberId or with visibility
    return appActionRepository.getForManyItems(itemIds, filters);
  }
}
