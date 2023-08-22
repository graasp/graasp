import { AppAction, PermissionLevel } from '@graasp/sdk';

import HookManager from '../../../../../utils/hook';
import { Repositories } from '../../../../../utils/repositories';
import { validatePermission } from '../../../../authorization';
import { ManyItemsGetFilter, SingleItemGetFilter } from '../interfaces/request';
import { AppActionNotAccessible } from './errors';
import { InputAppAction } from './interfaces/app-action';

export class AppActionService {
  hooks = new HookManager<{
    post: {
      pre: { appAction: Partial<InputAppAction>; itemId: string };
      post: { appAction: AppAction; itemId: string };
    };
  }>();
  async post(actorId, repositories: Repositories, itemId: string, body: Partial<InputAppAction>) {
    const { appActionRepository, memberRepository, itemRepository } = repositories;
    // TODO: check member exists
    const member = await memberRepository.get(actorId);

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // posting an app action is allowed to readers
    await validatePermission(repositories, PermissionLevel.Read, member, item);

    await this.hooks.runPreHooks('post', member, repositories, { appAction: body, itemId });

    const appAction = await appActionRepository.post(itemId, actorId, body);
    await this.hooks.runPostHooks('post', member, repositories, {
      appAction,
      itemId,
    });
    return appAction;
  }

  async getForItem(
    actorId,
    repositories: Repositories,
    itemId: string,
    filters: SingleItemGetFilter,
  ) {
    const { appActionRepository, memberRepository, itemRepository } = repositories;

    // check member exists
    const member = await memberRepository.get(actorId);

    // check item exists
    const item = await itemRepository.get(itemId);

    // posting an app action is allowed to readers
    const membership = await validatePermission(repositories, PermissionLevel.Read, member, item);
    const permission = membership?.permission;
    let { memberId: fMemberId } = filters;

    // can read only own app action if not admin
    if (permission !== PermissionLevel.Admin) {
      if (!fMemberId) {
        fMemberId = actorId;
      } else if (fMemberId !== actorId) {
        throw new AppActionNotAccessible();
      }
    }

    return appActionRepository.getForItem(itemId, { memberId: fMemberId });
  }

  async getForManyItems(
    actorId,
    repositories: Repositories,
    itemIds: string[],
    filters: ManyItemsGetFilter,
  ) {
    const { appActionRepository, memberRepository, itemRepository } = repositories;

    // check member exists
    const member = await memberRepository.get(actorId);

    // check item exists
    const item = await itemRepository.get(itemIds[0]);

    // posting an app action is allowed to readers
    const membership = await validatePermission(repositories, PermissionLevel.Read, member, item);
    const permission = membership?.permission;
    let { memberId: fMemberId } = filters;

    // can read only own app action if not admin
    if (permission !== PermissionLevel.Admin) {
      if (!fMemberId) {
        fMemberId = actorId;
      } else if (fMemberId !== actorId) {
        throw new AppActionNotAccessible();
      }
    }

    // TODO: get only memberId or with visibility
    return appActionRepository.getForManyItems(itemIds, filters);
  }
}
