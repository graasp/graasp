import { PermissionLevel } from '@graasp/sdk';

import HookManager from '../../../../../utils/hook';
import { Repositories } from '../../../../../utils/repositories';
import { validatePermission } from '../../../../authorization';
import { Member } from '../../../../member/entities/member';
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
    member: Member,
    repositories: Repositories,
    itemId: string,
    body: Partial<InputAppAction>,
  ) {
    const { appActionRepository, itemRepository } = repositories;

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // posting an app action is allowed to readers
    await validatePermission(repositories, PermissionLevel.Read, member, item);

    await this.hooks.runPreHooks('post', member, repositories, { appAction: body, itemId });

    const appAction = await appActionRepository.post(itemId, member.id, body);
    await this.hooks.runPostHooks('post', member, repositories, {
      appAction,
      itemId,
    });
    return appAction;
  }

  async getForItem(
    member: Member,
    repositories: Repositories,
    itemId: string,
    filters: SingleItemGetFilter,
  ) {
    const { appActionRepository, itemRepository } = repositories;

    // check item exists
    const item = await itemRepository.get(itemId);

    // posting an app action is allowed to readers
    const { itemMembership } = await validatePermission(
      repositories,
      PermissionLevel.Read,
      member,
      item,
    );
    const permission = itemMembership?.permission;
    let { memberId: fMemberId } = filters;

    // can read only own app action if not admin
    if (permission !== PermissionLevel.Admin) {
      if (!fMemberId) {
        fMemberId = member.id;
      } else if (fMemberId !== member.id) {
        throw new AppActionNotAccessible();
      }
    }

    return appActionRepository.getForItem(itemId, { memberId: fMemberId });
  }

  async getForManyItems(
    member: Member,
    repositories: Repositories,
    itemIds: string[],
    filters: ManyItemsGetFilter,
  ) {
    const { appActionRepository, itemRepository } = repositories;

    // check item exists
    const item = await itemRepository.get(itemIds[0]);

    // posting an app action is allowed to readers
    const { itemMembership } = await validatePermission(
      repositories,
      PermissionLevel.Read,
      member,
      item,
    );
    const permission = itemMembership?.permission;
    let { memberId: fMemberId } = filters;

    // can read only own app action if not admin
    if (permission !== PermissionLevel.Admin) {
      if (!fMemberId) {
        fMemberId = member.id;
      } else if (fMemberId !== member.id) {
        throw new AppActionNotAccessible();
      }
    }

    // TODO: get only memberId or with visibility
    return appActionRepository.getForManyItems(itemIds, filters);
  }
}
