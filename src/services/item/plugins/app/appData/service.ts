import { defineAbility } from '@casl/ability';

import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../../util/repositories';
import { validatePermission } from '../../../../authorization';
import { ItemMembership } from '../../../../itemMembership/entities/ItemMembership';
import { Member } from '../../../../member/entities/member';
import { AppDataVisibility } from '../interfaces/app-details';
import { AppDataNotAccessible } from '../util/graasp-apps-error';
import { AppData } from './appData';
import { InputAppData } from './interfaces/app-data';

const adaptFilters = (
  filters: Partial<InputAppData>,
  permission: PermissionLevel,
  actorId: string,
) => {
  // TODO: optimize
  // admin can get all app data from everyone
  // otherwise get member's AppData or others' AppData w/ visibility 'item'
  const finalFilters = { ...filters };
  const { memberId: fMemberId, visibility: fVisibility } = finalFilters;
  if (permission !== PermissionLevel.Admin) {
    let op;

    if (!fMemberId) {
      if (fVisibility !== AppDataVisibility.ITEM) {
        finalFilters.memberId = actorId; // get member's AppData
        if (!fVisibility) {
          // + any AppData w/ visibility 'item'
          finalFilters.visibility = AppDataVisibility.ITEM;
          op = 'OR';
        }
      }
    } else if (fMemberId !== actorId) {
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
  async post(
    actorId: string,
    repositories: Repositories,
    itemId: string,
    body: Partial<InputAppData>,
  ) {
    const { appDataRepository, memberRepository, itemRepository } = repositories;
    // TODO: check member exists
    const member = await memberRepository.get(actorId);

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // posting an app data is allowed to readers
    const membership = await validatePermission(repositories, PermissionLevel.Read, member, item);

    let attachedToMemberId = actorId;
    // only admin can write app data for others
    if (membership.permission === PermissionLevel.Admin) {
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
    memberId: string,
    repositories: Repositories,
    itemId: string,
    appDataId: string,
    body: Partial<AppData>,
  ) {
    const { appDataRepository, memberRepository, itemRepository } = repositories;
    // TODO: check member exists
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

    return appDataRepository.patch(itemId, appDataId, body);
  }

  async deleteOne(memberId: string, repositories: Repositories, itemId: string, appDataId: string) {
    const { appDataRepository, memberRepository, itemRepository } = repositories;
    // TODO: check member exists
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

    return appDataRepository.deleteOne(itemId, appDataId);
  }

  async getForItem(
    memberId: string,
    repositories: Repositories,
    itemId: string,
    filters: Partial<InputAppData>,
  ) {
    const { appDataRepository, memberRepository, itemRepository } = repositories;

    const member = await memberRepository.get(memberId);

    // check item exists? let post fail?
    const item = await itemRepository.get(itemId);

    // posting an app data is allowed to readers
    const membership = await validatePermission(repositories, PermissionLevel.Read, member, item);

    const finalFilters = adaptFilters(filters, membership.permission, memberId);

    // TODO: get only memberId or with visibility
    return appDataRepository.getForItem(itemId, { ...finalFilters });
  }

  // TODO: check for many items
  async getForManyItems(
    memberId: string,
    repositories: Repositories,
    itemIds: string[],
    filters: Partial<InputAppData>,
  ) {
    const { appDataRepository, memberRepository, itemRepository } = repositories;

    // check member exists
    const member = await memberRepository.get(memberId);

    // check item exists? let post fail?
    const item = await itemRepository.get(itemIds[0]);

    // posting an app data is allowed to readers
    const membership = await validatePermission(repositories, PermissionLevel.Read, member, item);
    const finalFilters = adaptFilters(filters, membership.permission, memberId);

    // TODO: get only memberId or with visibility
    return appDataRepository.getForManyItems(itemIds, finalFilters);
  }

  // TODO: check
  async validateAppDataPermission(
    repositories: Repositories,
    member: Member,
    appData: AppData,
    permission: PermissionLevel,
    inheritedMembership?: ItemMembership,
  ) {
    const isValid =
      // inheritedMembership?.permission &&
      ownAppDataAbility(member).can(permission, appData) ||
      itemVisibilityAppDataAbility(member).can(permission, appData) ||
      permissionMapping[inheritedMembership.permission].includes(permission);

    return isValid;
  }
}
