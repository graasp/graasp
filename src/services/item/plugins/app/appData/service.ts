import { singleton } from 'tsyringe';

import { AppDataVisibility, PermissionLevel, UUID } from '@graasp/sdk';

import HookManager from '../../../../../utils/hook';
import { Repositories } from '../../../../../utils/repositories';
import { validatePermission } from '../../../../authorization';
import { ItemMembership } from '../../../../itemMembership/entities/ItemMembership';
import { Actor, Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { AppData } from './appData';
import { AppDataNotAccessible, AppDataNotFound, PreventUpdateOtherAppData } from './errors';
import { InputAppData } from './interfaces/app-data';

const ownAppDataAbility = (appData: AppData, member: Actor) => {
  if (!appData.creator || !member) {
    return false;
  }
  return appData.creator.id === member.id;
};

const itemVisibilityAppDataAbility = (
  appData,
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
    member: Member,
    repositories: Repositories,
    itemId: string,
    body: Partial<InputAppData>,
  ) {
    const { appDataRepository, itemRepository } = repositories;

    // check item exists? let post fail?
    const item = await itemRepository.getOneOrThrow(itemId);

    // posting an app data is allowed to readers
    await validatePermission(repositories, PermissionLevel.Read, member, item);

    // any user can write app data for others
    const attachedToMemberId = body.memberId ?? member.id;

    const completeData = Object.assign(
      {
        visibility: AppDataVisibility.Member,
      },
      body,
      {
        memberId: attachedToMemberId,
      },
    );

    await this.hooks.runPreHooks('post', member, repositories, { appData: body, itemId });

    const appData = await appDataRepository.addOne({
      appData: completeData,
      itemId,
      actorId: member.id,
    });
    await this.hooks.runPostHooks('post', member, repositories, { appData, itemId });
    return appData;
  }

  async patch(
    member: Member,
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
      member,
      item,
    );

    const currentAppData = await appDataRepository.getOne(appDataId);

    if (!currentAppData) {
      throw new AppDataNotFound(appDataId);
    }

    // patch own or is admin
    const isValid = await this.validateAppDataPermission(
      repositories,
      member,
      currentAppData,
      PermissionLevel.Write,
      inheritedMembership,
    );
    if (!isValid) {
      throw new PreventUpdateOtherAppData(appDataId);
    }

    await this.hooks.runPreHooks('patch', member, repositories, {
      appData: { ...body, id: appDataId },
      itemId,
    });

    const appData = await appDataRepository.updateOne(appDataId, body);
    await this.hooks.runPostHooks('patch', member, repositories, {
      appData,
      itemId,
    });
    return appData;
  }

  async deleteOne(member: Member, repositories: Repositories, itemId: string, appDataId: string) {
    const { appDataRepository, itemRepository } = repositories;

    // check item exists? let post fail?
    const item = await itemRepository.getOneOrThrow(itemId);

    // delete an app data is allowed to readers
    const { itemMembership: inheritedMembership } = await validatePermission(
      repositories,
      PermissionLevel.Read,
      member,
      item,
    );

    const appData = await appDataRepository.getOne(appDataId);

    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }

    // patch own or is admin
    await this.validateAppDataPermission(
      repositories,
      member,
      appData,
      PermissionLevel.Admin,
      inheritedMembership,
    );

    await this.hooks.runPreHooks('delete', member, repositories, { appDataId, itemId });

    const result = await appDataRepository.deleteOne(appDataId);

    await this.hooks.runPostHooks('delete', member, repositories, { appData, itemId });

    return result;
  }

  async get(member: Member, repositories: Repositories, item: Item, appDataId: UUID) {
    const { appDataRepository } = repositories;

    const { itemMembership } = await validatePermission(
      repositories,
      PermissionLevel.Read,
      member,
      item,
    );

    const appData = await appDataRepository.getOne(appDataId);

    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }

    if (
      !this.validateAppDataPermission(
        repositories,
        member,
        appData,
        PermissionLevel.Read,
        itemMembership,
      )
    ) {
      throw new AppDataNotAccessible({ appDataId, memberId: member.id });
    }

    return appData;
  }

  async getForItem(member: Member, repositories: Repositories, itemId: string, type?: string) {
    const { appDataRepository, itemRepository } = repositories;

    // check item exists? let post fail?
    const item = await itemRepository.getOneOrThrow(itemId);

    // posting an app data is allowed to readers
    const { itemMembership } = await validatePermission(
      repositories,
      PermissionLevel.Read,
      member,
      item,
    );

    return appDataRepository.getForItem(
      itemId,
      { memberId: member.id, type },
      itemMembership?.permission,
    );
  }

  // TODO: check for many items
  async getForManyItems(member: Member, repositories: Repositories, itemIds: string[]) {
    const { appDataRepository, itemRepository } = repositories;

    // check item exists? let post fail?
    const items = await itemRepository.getMany(itemIds);

    // posting an app data is allowed to readers
    const result = { data: {}, errors: items.errors };
    for (const itemId of itemIds) {
      const item = items.data[itemId];
      if (!item) {
        // errors already contained from getMany
        return result;
      }
      // TODO: optimize
      const { itemMembership } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        member,
        item,
      );
      const appData = await appDataRepository.getForItem(
        itemId,
        { memberId: member.id },
        itemMembership?.permission,
      );
      result.data[itemId] = appData;
      return result;
    }

    // TODO: get only memberId or with visibility
  }

  // TODO: check
  async validateAppDataPermission(
    repositories: Repositories,
    member: Actor,
    appData: AppData,
    permission: PermissionLevel,
    inheritedMembership?: ItemMembership | null,
  ) {
    const isValid =
      ownAppDataAbility(appData, member) ||
      itemVisibilityAppDataAbility(appData, permission, inheritedMembership?.permission) ||
      (inheritedMembership &&
        permissionMapping[inheritedMembership.permission].includes(permission));

    return isValid;
  }
}
