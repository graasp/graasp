import { singleton } from 'tsyringe';

import { AppDataVisibility, PermissionLevel, UUID } from '@graasp/sdk';

import HookManager from '../../../../../utils/hook';
import { Repositories } from '../../../../../utils/repositories';
import { Account } from '../../../../account/entities/account';
import { validatePermission } from '../../../../authorization';
import { ItemMembership } from '../../../../itemMembership/entities/ItemMembership';
import { Actor } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { AppData } from './appData';
import { AppDataNotAccessible, AppDataNotFound, PreventUpdateOtherAppData } from './errors';
import { InputAppData } from './interfaces/app-data';

const ownAppDataAbility = (appData: AppData, actor: Actor) => {
  if (!appData.creator || !actor) {
    return false;
  }
  return appData.creator.id === actor.id;
};

const itemVisibilityAppDataAbility = (
  appData: AppData,
  permission: PermissionLevel,
  memberPermission?: PermissionLevel,
) => {
  if (appData.visibility === AppDataVisibility.Item) {
    // can always read an app data with visibility item
    if (permission === PermissionLevel.Read) {
      return true;
    }
    // on write/admin
    else {
      // cannot update without membership
      if (!memberPermission) {
        return false;
      }

      return permissionMapping[memberPermission].includes(permission);
    }
  }
};

// TODO: factor out
const permissionMapping = {
  [PermissionLevel.Read]: [PermissionLevel.Read],
  [PermissionLevel.Write]: [PermissionLevel.Read, PermissionLevel.Write],
  [PermissionLevel.Admin]: [PermissionLevel.Read, PermissionLevel.Write, PermissionLevel.Admin],
};

@singleton()
export class AppDataService {
  hooks = new HookManager<{
    post: {
      pre: { appData: Partial<InputAppData>; itemId: string };
      post: { appData: AppData; itemId: string };
    };
    patch: {
      pre: { appData: Partial<AppData>; itemId: string };
      post: { appData: AppData; itemId: string };
    };
    delete: {
      pre: { appDataId: string; itemId: string };
      post: { appData: AppData; itemId: string };
    };
  }>();

  async post(
    account: Account,
    repositories: Repositories,
    itemId: string,
    body: Partial<InputAppData>,
  ) {
    const { appDataRepository, itemRepository } = repositories;

    // check item exists? let post fail?
    const item = await itemRepository.getOneOrThrow(itemId);

    // posting an app data is allowed to readers
    await validatePermission(repositories, PermissionLevel.Read, account, item);

    // any user can write app data for others
    const attachedToMemberId = body.accountId ?? body.memberId ?? account.id;

    const completeData = Object.assign(
      {
        visibility: AppDataVisibility.Member,
      },
      body,
      {
        accountId: attachedToMemberId,
      },
    );

    await this.hooks.runPreHooks('post', account, repositories, { appData: body, itemId });

    const appData = await appDataRepository.addOne({
      appData: completeData,
      itemId,
      actorId: account.id,
    });
    await this.hooks.runPostHooks('post', account, repositories, { appData, itemId });
    return appData;
  }

  async patch(
    account: Account,
    repositories: Repositories,
    itemId: string,
    appDataId: string,
    body: Partial<AppData>,
  ) {
    const { appDataRepository, itemRepository } = repositories;

    // check item exists? let post fail?
    const item = await itemRepository.getOneOrThrow(itemId);

    // patching requires at least read
    const { itemMembership: inheritedMembership } = await validatePermission(
      repositories,
      PermissionLevel.Read,
      account,
      item,
    );

    const currentAppData = await appDataRepository.getOne(appDataId);

    if (!currentAppData) {
      throw new AppDataNotFound(appDataId);
    }

    // patch own or is admin
    const isValid = await this.validateAppDataPermission(
      repositories,
      account,
      currentAppData,
      PermissionLevel.Write,
      inheritedMembership,
    );
    if (!isValid) {
      throw new PreventUpdateOtherAppData(appDataId);
    }

    await this.hooks.runPreHooks('patch', account, repositories, {
      appData: { ...body, id: appDataId },
      itemId,
    });

    const appData = await appDataRepository.updateOne(appDataId, body);
    await this.hooks.runPostHooks('patch', account, repositories, {
      appData,
      itemId,
    });
    return appData;
  }

  async deleteOne(account: Account, repositories: Repositories, itemId: string, appDataId: string) {
    const { appDataRepository, itemRepository } = repositories;

    // check item exists? let post fail?
    const item = await itemRepository.getOneOrThrow(itemId);

    // delete an app data is allowed to readers
    const { itemMembership: inheritedMembership } = await validatePermission(
      repositories,
      PermissionLevel.Read,
      account,
      item,
    );

    const appData = await appDataRepository.getOne(appDataId);

    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }

    // patch own or is admin
    await this.validateAppDataPermission(
      repositories,
      account,
      appData,
      PermissionLevel.Admin,
      inheritedMembership,
    );

    await this.hooks.runPreHooks('delete', account, repositories, { appDataId, itemId });

    const result = await appDataRepository.deleteOne(appDataId);

    await this.hooks.runPostHooks('delete', account, repositories, { appData, itemId });

    return result;
  }

  async get(account: Account, repositories: Repositories, item: Item, appDataId: UUID) {
    const { appDataRepository } = repositories;

    const { itemMembership } = await validatePermission(
      repositories,
      PermissionLevel.Read,
      account,
      item,
    );

    const appData = await appDataRepository.getOne(appDataId);

    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }

    if (
      !this.validateAppDataPermission(
        repositories,
        account,
        appData,
        PermissionLevel.Read,
        itemMembership,
      )
    ) {
      throw new AppDataNotAccessible({ appDataId, accountId: account.id });
    }

    return appData;
  }

  async getForItem(account: Account, repositories: Repositories, itemId: string, type?: string) {
    const { appDataRepository, itemRepository } = repositories;

    // check item exists? let post fail?
    const item = await itemRepository.getOneOrThrow(itemId);

    // posting an app data is allowed to readers
    const { itemMembership } = await validatePermission(
      repositories,
      PermissionLevel.Read,
      account,
      item,
    );

    return appDataRepository.getForItem(
      itemId,
      { accountId: account.id, type },
      itemMembership?.permission,
    );
  }

  // TODO: check
  async validateAppDataPermission(
    repositories: Repositories,
    actor: Actor,
    appData: AppData,
    permission: PermissionLevel,
    inheritedMembership?: ItemMembership | null,
  ) {
    const isValid =
      ownAppDataAbility(appData, actor) ||
      itemVisibilityAppDataAbility(appData, permission, inheritedMembership?.permission) ||
      (inheritedMembership &&
        permissionMapping[inheritedMembership.permission].includes(permission));

    return isValid;
  }
}
