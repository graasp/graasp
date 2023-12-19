import { AppDataVisibility, PermissionLevel, UUID } from '@graasp/sdk';

import { MemberCannotWriteItem, UnauthorizedMember } from '../../../../../utils/errors';
import HookManager from '../../../../../utils/hook';
import { Repositories } from '../../../../../utils/repositories';
import { validatePermission } from '../../../../authorization';
import { ItemMembership } from '../../../../itemMembership/entities/ItemMembership';
import { Actor } from '../../../../member/entities/member';
import { AppData } from './appData';
import { AppDataNotAccessible, PreventUpdateOtherAppData } from './errors';
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
    actorId: string | undefined,
    repositories: Repositories,
    itemId: string,
    body: Partial<InputAppData>,
  ) {
    const { appDataRepository, memberRepository, itemRepository } = repositories;

    // check member exists
    if (!actorId) {
      throw new MemberCannotWriteItem();
    }
    const actor = await memberRepository.get(actorId);

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // posting an app data is allowed to readers
    const membership = await validatePermission(repositories, PermissionLevel.Read, actor, item);

    let attachedToMemberId = actorId;
    // only admin can write app data for others
    if (membership?.permission === PermissionLevel.Admin) {
      attachedToMemberId = body.memberId ?? actorId;
    }
    const completeData = Object.assign(
      {
        visibility: AppDataVisibility.Member,
      },
      body,
      {
        memberId: attachedToMemberId,
      },
    );

    await this.hooks.runPreHooks('post', actor, repositories, { appData: body, itemId });

    const appData = await appDataRepository.post(itemId, actorId, completeData);
    await this.hooks.runPostHooks('post', actor, repositories, { appData, itemId });
    return appData;
  }

  async patch(
    memberId: string | undefined,
    repositories: Repositories,
    itemId: string,
    appDataId: string,
    body: Partial<AppData>,
  ) {
    const { appDataRepository, memberRepository, itemRepository } = repositories;
    // check member exists
    if (!memberId) {
      throw new MemberCannotWriteItem();
    }
    const member = await memberRepository.get(memberId);

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // patching requires at least read
    const inheritedMembership = await validatePermission(
      repositories,
      PermissionLevel.Read,
      member,
      item,
    );

    const currentAppData = await appDataRepository.get(appDataId);

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

    const appData = await appDataRepository.patch(itemId, appDataId, body);
    await this.hooks.runPostHooks('patch', member, repositories, {
      appData,
      itemId,
    });
    return appData;
  }

  async deleteOne(
    memberId: string | undefined,
    repositories: Repositories,
    itemId: string,
    appDataId: string,
  ) {
    const { appDataRepository, memberRepository, itemRepository } = repositories;
    // check member exists
    if (!memberId) {
      throw new MemberCannotWriteItem();
    }
    const member = await memberRepository.get(memberId);

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // delete an app data is allowed to readers
    const inheritedMembership = await validatePermission(
      repositories,
      PermissionLevel.Read,
      member,
      item,
    );

    const appData = await appDataRepository.get(appDataId);

    // patch own or is admin
    await this.validateAppDataPermission(
      repositories,
      member,
      appData,
      PermissionLevel.Admin,
      inheritedMembership,
    );

    await this.hooks.runPreHooks('delete', member, repositories, { appDataId, itemId });

    const result = await appDataRepository.deleteOne(itemId, appDataId);

    await this.hooks.runPostHooks('delete', member, repositories, { appData, itemId });

    return result;
  }

  async get(
    memberId: string | undefined,
    repositories: Repositories,
    itemId: UUID,
    appDataId: UUID,
  ) {
    const { appDataRepository, memberRepository, itemRepository } = repositories;

    // get member if exists
    // item can be public
    const member = memberId ? await memberRepository.get(memberId) : undefined;

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    const membership = await validatePermission(repositories, PermissionLevel.Read, member, item);

    const appData = await appDataRepository.get(appDataId);

    if (
      !this.validateAppDataPermission(
        repositories,
        member,
        appData,
        PermissionLevel.Read,
        membership,
      )
    ) {
      throw new AppDataNotAccessible({ appDataId, memberId });
    }

    return appData;
  }

  async getForItem(
    memberId: string | undefined,
    repositories: Repositories,
    itemId: string,
    type?: string,
  ) {
    const { appDataRepository, memberRepository, itemRepository } = repositories;

    // get member
    if (!memberId) {
      throw new UnauthorizedMember(memberId);
    }
    const member = await memberRepository.get(memberId);

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // posting an app data is allowed to readers
    const membership = await validatePermission(repositories, PermissionLevel.Read, member, item);

    return appDataRepository.getForItem(itemId, { memberId, type }, membership?.permission);
  }

  // TODO: check for many items
  async getForManyItems(
    memberId: string | undefined,
    repositories: Repositories,
    itemIds: string[],
  ) {
    const { appDataRepository, memberRepository, itemRepository } = repositories;

    // get member
    if (!memberId) {
      throw new UnauthorizedMember(memberId);
    }
    const member = await memberRepository.get(memberId);

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
      const membership = await validatePermission(repositories, PermissionLevel.Read, member, item);
      const appData = await appDataRepository.getForItem(
        itemId,
        { memberId },
        membership?.permission,
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
