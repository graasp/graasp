import { PermissionLevel, UUID } from '@graasp/sdk';

import { MemberCannotAccess, UnauthorizedMember } from '../../../../../utils/errors';
import HookManager from '../../../../../utils/hook';
import { Repositories } from '../../../../../utils/repositories';
import { Actor } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemService } from '../../../service';
import { AppSetting } from './appSettings';
import { InputAppSetting } from './interfaces/app-setting';

export class AppSettingService {
  itemService: ItemService;
  hooks = new HookManager<{
    post: {
      pre: { appSetting: Partial<InputAppSetting>; itemId: string };
      post: { appSetting: AppSetting; itemId: string };
    };
    patch: {
      pre: { appSetting: Partial<AppSetting>; itemId: string };
      post: { appSetting: AppSetting; itemId: string };
    };
    delete: {
      pre: { appSettingId: string; itemId: string };
      post: { appSetting: AppSetting; itemId: string };
    };
    copyMany: {
      pre: { appSettings: AppSetting[]; originalItemId: string; copyItemId: string };
      post: { appSettings: AppSetting[]; originalItemId: string; copyItemId: string };
    };
  }>();

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

    await this.hooks.runPreHooks('post', member, repositories, { appSetting: body, itemId });

    const appSetting = await appSettingRepository.post(itemId, memberId, body);
    await this.hooks.runPostHooks('post', member, repositories, {
      appSetting,
      itemId,
    });
    return appSetting;
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

    await this.hooks.runPreHooks('patch', member, repositories, {
      appSetting: { ...body, id: appSettingId },
      itemId,
    });

    const appSetting = await appSettingRepository.patch(itemId, appSettingId, body);
    await this.hooks.runPostHooks('patch', member, repositories, {
      appSetting,
      itemId,
    });
    return appSetting;
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

    await this.hooks.runPreHooks('delete', member, repositories, { appSettingId, itemId });

    const result = await appSettingRepository.deleteOne(itemId, appSettingId);

    await this.hooks.runPostHooks('delete', member, repositories, { appSetting, itemId });

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

    return appSettingRepository.get(appSettingId);
  }

  async getForItem(
    memberId: string | undefined,
    repositories: Repositories,
    itemId: string,
    name?: string,
  ) {
    const { appSettingRepository, memberRepository } = repositories;

    // get member if exists
    // item can be public
    const member = memberId ? await memberRepository.get(memberId) : undefined;

    // get app setting is allowed to readers
    await this.itemService.get(member, repositories, itemId);

    return appSettingRepository.getForItem(itemId, name);
  }

  async copyForItem(actor: Actor, repositories: Repositories, original: Item, copy: Item) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    try {
      const appSettings = await this.getForItem(actor.id, repositories, original.id);
      const newAppSettings: AppSetting[] = [];
      for (const appS of appSettings) {
        const copyData = {
          name: appS.name,
          data: appS.data,
          itemId: copy.id,
          creator: { id: actor.id },
        };
        await this.hooks.runPreHooks('copyMany', actor, repositories, {
          appSettings,
          originalItemId: original.id,
          copyItemId: copy.id,
        });
        const newSetting = await repositories.appSettingRepository.post(
          copy.id,
          appS.creator?.id,
          copyData,
        );
        newAppSettings.push(newSetting);
      }
      await this.hooks.runPostHooks('copyMany', actor, repositories, {
        appSettings: newAppSettings,
        originalItemId: original.id,
        copyItemId: copy.id,
      });
    } catch (err) {
      console.error(err);
    }
  }
}
