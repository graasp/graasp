import { singleton } from 'tsyringe';

import { PermissionLevel, UUID } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../../utils/errors';
import HookManager from '../../../../../utils/hook';
import { Repositories } from '../../../../../utils/repositories';
import { Actor, Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemService } from '../../../service';
import { AppSetting } from './appSettings';
import { InputAppSetting } from './interfaces/app-setting';

@singleton()
export class AppSettingService {
  private readonly itemService: ItemService;
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
    member: Member,
    repositories: Repositories,
    itemId: string,
    body: Partial<InputAppSetting>,
  ) {
    const { appSettingRepository } = repositories;

    // posting an app setting is allowed to admin only
    await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);

    await this.hooks.runPreHooks('post', member, repositories, { appSetting: body, itemId });

    const appSetting = await appSettingRepository.addOne({
      itemId,
      memberId: member.id,
      appSetting: body,
    });
    await this.hooks.runPostHooks('post', member, repositories, {
      appSetting,
      itemId,
    });
    return appSetting;
  }

  async patch(
    member: Member,
    repositories: Repositories,
    itemId: string,
    appSettingId: string,
    body: Partial<AppSetting>,
  ) {
    const { appSettingRepository } = repositories;

    // patching requires admin rights
    await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);

    await this.hooks.runPreHooks('patch', member, repositories, {
      appSetting: { ...body, id: appSettingId },
      itemId,
    });

    const appSetting = await appSettingRepository.updateOne(appSettingId, body);
    await this.hooks.runPostHooks('patch', member, repositories, {
      appSetting,
      itemId,
    });
    return appSetting;
  }

  async deleteOne(
    member: Member,
    repositories: Repositories,
    itemId: string,
    appSettingId: string,
  ) {
    const { appSettingRepository } = repositories;

    // delete an app data is allowed to admins
    await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);

    const appSetting = await appSettingRepository.getOneOrThrow(appSettingId);

    await this.hooks.runPreHooks('delete', member, repositories, { appSettingId, itemId });

    const { id: result } = await appSettingRepository.deleteOne(appSettingId);

    await this.hooks.runPostHooks('delete', member, repositories, { appSetting, itemId });

    return result;
  }

  async get(
    member: Member | undefined,
    repositories: Repositories,
    itemId: string,
    appSettingId: UUID,
  ) {
    const { appSettingRepository } = repositories;

    // get app setting is allowed to readers
    await this.itemService.get(member, repositories, itemId);

    return await appSettingRepository.getOneOrThrow(appSettingId);
  }

  async getForItem(
    member: Member | undefined,
    repositories: Repositories,
    itemId: string,
    name?: string,
  ) {
    const { appSettingRepository } = repositories;

    // item can be public
    // get app setting is allowed to readers
    await this.itemService.get(member, repositories, itemId);

    return appSettingRepository.getForItem(itemId, name);
  }

  async copyForItem(actor: Actor, repositories: Repositories, original: Item, copy: Item) {
    if (!actor) {
      throw new UnauthorizedMember();
    }
    try {
      const appSettings = await this.getForItem(actor, repositories, original.id);
      const newAppSettings: AppSetting[] = [];
      for (const appSetting of appSettings) {
        const copyData = {
          name: appSetting.name,
          data: appSetting.data,
          itemId: copy.id,
          creator: { id: actor.id },
        };
        await this.hooks.runPreHooks('copyMany', actor, repositories, {
          appSettings,
          originalItemId: original.id,
          copyItemId: copy.id,
        });
        const newSetting = await repositories.appSettingRepository.addOne({
          itemId: copy.id,
          memberId: appSetting.creator?.id,
          appSetting: copyData,
        });
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
