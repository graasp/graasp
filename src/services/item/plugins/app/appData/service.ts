import { defineAbility } from '@casl/ability';

import { PermissionLevel, UUID } from '@graasp/sdk';

import { MemberCannotWriteItem, UnauthorizedMember } from '../../../../../utils/errors';
import HookManager from '../../../../../utils/hook';
import { Repositories } from '../../../../../utils/repositories';
import { validatePermission } from '../../../../authorization';
import { ItemMembership } from '../../../../itemMembership/entities/ItemMembership';
import { Actor } from '../../../../member/entities/member';
import { AppDataVisibility } from '../interfaces/app-details';
import { AppData, Filters } from './appData';
import { AppDataNotAccessible } from './errors';
import { InputAppData } from './interfaces/app-data';

const adaptFilters = (
  filters: Filters,
  permission: PermissionLevel | undefined,
  actorId: string,
) => {
  // TODO: optimize
  // admin can get all app data from everyone
  // otherwise get member's AppData or others' AppData w/ visibility 'item'
  let finalFilters = { ...filters };
  const { member: fMember, visibility: fVisibility } = finalFilters;
  if (permission !== PermissionLevel.Admin) {
    let op;

    if (!fMember?.id) {
      if (fVisibility !== AppDataVisibility.ITEM) {
        finalFilters = { ...finalFilters, member: { id: actorId } }; // get member's AppData
        if (!fVisibility) {
          // + any AppData w/ visibility 'item'
          finalFilters.visibility = AppDataVisibility.ITEM;
          op = 'OR';
        }
      }
    } else if (fMember?.id !== actorId) {
      if (fVisibility !== AppDataVisibility.ITEM) {
        if (fVisibility === AppDataVisibility.MEMBER) throw new AppDataNotAccessible();
        finalFilters.visibility = AppDataVisibility.ITEM; // force 'item' visibility while fetching others' AppData
      }
    }
    return finalFilters;
  }
};

const ownAppDataAbility = (member) =>
  defineAbility((can, cannot) => {
    can(PermissionLevel.Read, 'AppData', { member: member.id });
    can(PermissionLevel.Write, 'AppData', { member: member.id });
    can(PermissionLevel.Admin, 'AppData', { member: member.id });
  });

const itemVisibilityAppDataAbility = (member) =>
  defineAbility((can, cannot) => {
    can(PermissionLevel.Read, 'AppData', { visibility: AppDataVisibility.ITEM });
  });

// TODO: factor ut
const permissionMapping = {
  [PermissionLevel.Read]: [PermissionLevel.Read],
  [PermissionLevel.Write]: [PermissionLevel.Read, PermissionLevel.Write],
  [PermissionLevel.Admin]: [PermissionLevel.Read, PermissionLevel.Write, PermissionLevel.Admin],
};

export class AppDataService {
  hooks = new HookManager();

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
    const member = await memberRepository.get(actorId);

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // posting an app data is allowed to readers
    const membership = await validatePermission(repositories, PermissionLevel.Read, member, item);

    let attachedToMemberId = actorId;
    // only admin can write app data for others
    if (membership?.permission === PermissionLevel.Admin) {
      attachedToMemberId = body.memberId ?? actorId;
    }
    const completeData = Object.assign(
      {
        visibility: AppDataVisibility.MEMBER,
      },
      body,
      {
        memberId: attachedToMemberId,
        creator: actorId,
        itemId,
      },
    );

    return appDataRepository.post(itemId, actorId, completeData);
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

    const appData = await appDataRepository.get(appDataId);

    // patch own or is admin
    await this.validateAppDataPermission(
      repositories,
      member,
      appData,
      PermissionLevel.Write,
      inheritedMembership,
    );

    await this.hooks.runPreHooks('patch', member, repositories, appData);

    return appDataRepository.patch(itemId, appDataId, body);
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

    const result = await appDataRepository.deleteOne(itemId, appDataId);

    await this.hooks.runPostHooks('delete', member, repositories, appData);

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
    filters: Filters,
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

    const finalFilters = adaptFilters(filters, membership?.permission, memberId);

    // TODO: get only memberId or with visibility
    return appDataRepository.getForItem(itemId, { ...finalFilters });
  }

  // TODO: check for many items
  async getForManyItems(
    memberId: string | undefined,
    repositories: Repositories,
    itemIds: string[],
    filters: Filters,
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
      const finalFilters = adaptFilters(filters, membership?.permission, memberId);
      const appData = await appDataRepository.getForItem(itemId, finalFilters);
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
      // inheritedMembership?.permission &&
      ownAppDataAbility(member).can(permission, appData) ||
      itemVisibilityAppDataAbility(member).can(permission, appData) ||
      (inheritedMembership &&
        permissionMapping[inheritedMembership.permission].includes(permission));

    return isValid;
  }
}
