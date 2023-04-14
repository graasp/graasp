import { PermissionLevel, UUID } from '@graasp/sdk';

import { MemberCannotAccess } from '../../../../../util/graasp-error';
import HookManager from '../../../../../util/hook';
import { Repositories } from '../../../../../util/repositories';
import { Item } from '../../../entities/Item';
import ItemService from '../../../service';
import { AppSetting } from './appSettings';
import { InputAppSetting } from './interfaces/app-setting';

export class AppSettingService {
  itemService: ItemService;
  hooks = new HookManager();

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async post(
    memberId: string | undefined,
    repositories: Repositories,
    itemId: string,
    body: Partial<InputAppSetting>,
  ) {
    const { appSettingRepository, memberRepository } = repositories;
    // check member exists
    if (!memberId) {
      throw new MemberCannotAccess();
    }
    const member = await memberRepository.get(memberId);

    // posting an app setting is allowed to admin only
    await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);

    return appSettingRepository.post(itemId, memberId, body);
  }

  async patch(
    memberId: string | undefined,
    repositories: Repositories,
    itemId: string,
    appSettingId: string,
    body: Partial<AppSetting>,
  ) {
    const { appSettingRepository, memberRepository } = repositories;
    // check member exists
    if (!memberId) {
      throw new MemberCannotAccess();
    }
    const member = await memberRepository.get(memberId);

    // patching requires admin rights
    await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);

    const appSetting = await appSettingRepository.get(appSettingId);

    await this.hooks.runPreHooks('patch', member, repositories, appSetting);

    return appSettingRepository.patch(itemId, appSettingId, body);
  }

  async deleteOne(
    memberId: string | undefined,
    repositories: Repositories,
    itemId: string,
    appSettingId: string,
  ) {
    const { appSettingRepository, memberRepository } = repositories;
    // check member exists
    if (!memberId) {
      throw new MemberCannotAccess();
    }
    const member = await memberRepository.get(memberId);

    // delete an app data is allowed to admins
    await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);

    const appSetting = await appSettingRepository.get(appSettingId);

    const result = await appSettingRepository.deleteOne(itemId, appSettingId);

    await this.hooks.runPostHooks('delete', member, repositories, appSetting);

    return result;
  }

  async get(
    memberId: string | undefined,
    repositories: Repositories,
    itemId: string,
    appSettingId: UUID,
  ) {
    const { appSettingRepository, memberRepository } = repositories;

    // get member if exists
    // item can be public
    const member = memberId ? await memberRepository.get(memberId) : undefined;

    // get app setting is allowed to readers
    await this.itemService.get(member, repositories, itemId);

    // TODO: get only memberId or with visibility
    return appSettingRepository.get(appSettingId);
  }

  async getForItem(memberId: string | undefined, repositories: Repositories, itemId: string) {
    const { appSettingRepository, memberRepository } = repositories;

    // get member if exists
    // item can be public
    const member = memberId ? await memberRepository.get(memberId) : undefined;

    // get app setting is allowed to readers
    await this.itemService.get(member, repositories, itemId);

    // TODO: get only memberId or with visibility
    return appSettingRepository.getForItem(itemId);
  }

  async copyForItem(actor, repositories: Repositories, original: Item, copy: Item) {
    try {
      const appSettings = await this.getForItem(actor, repositories, original.id);
      const newAppSettings: AppSetting[] = [];
      for (const appS of appSettings) {
        const copyData = {
          name: appS.name,
          data: appS.data,
          itemId: copy.id,
          creator: { id: actor.id },
        };
        const newSetting = await repositories.appSettingRepository.post(
          copy.id,
          appS.memberId,
          copyData,
        );
        newAppSettings.push(newSetting);
      }
      await this.hooks.runPostHooks('copyMany', actor, repositories, newAppSettings);
    } catch (err) {
      console.error(err);
    }
  }
}
