import { singleton } from 'tsyringe';

import { PermissionLevel, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { UnauthorizedMember } from '../../../../../utils/errors';
import HookManager from '../../../../../utils/hook';
import { Actor, Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemService } from '../../../service';
import { AppSetting } from './appSettings';
import { InputAppSetting } from './interfaces/app-setting';
import { AppSettingRepository } from './repository';

@singleton()
export class AppSettingService {
  private readonly itemService: ItemService;
  private readonly appSettingRepository: AppSettingRepository;

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

  constructor(itemService: ItemService, appSettingRepository: AppSettingRepository) {
    this.itemService = itemService;
    this.appSettingRepository = appSettingRepository;
  }

  async post(db: DBConnection, member: Member, itemId: string, body: Partial<InputAppSetting>) {
    // posting an app setting is allowed to admin only
    await this.itemService.get(db, member, itemId, PermissionLevel.Admin);

    await this.hooks.runPreHooks('post', member, db, { appSetting: body, itemId });

    const appSetting = await this.appSettingRepository.addOne(db, {
      itemId,
      memberId: member.id,
      appSetting: body,
    });
    await this.hooks.runPostHooks('post', member, db, {
      appSetting,
      itemId,
    });
    return appSetting;
  }

  async patch(
    db: DBConnection,
    member: Member,
    itemId: string,
    appSettingId: string,
    body: Partial<AppSetting>,
  ) {
    // patching requires admin rights
    await this.itemService.get(db, member, itemId, PermissionLevel.Admin);

    await this.hooks.runPreHooks('patch', member, db, {
      appSetting: { ...body, id: appSettingId },
      itemId,
    });

    const appSetting = await this.appSettingRepository.updateOne(db, appSettingId, body);
    await this.hooks.runPostHooks('patch', member, db, {
      appSetting,
      itemId,
    });
    return appSetting;
  }

  async deleteOne(db: DBConnection, member: Member, itemId: string, appSettingId: string) {
    // delete an app data is allowed to admins
    await this.itemService.get(db, member, itemId, PermissionLevel.Admin);

    const appSetting = await this.appSettingRepository.getOneOrThrow(db, appSettingId);

    await this.hooks.runPreHooks('delete', member, db, { appSettingId, itemId });

    const { id: result } = await this.appSettingRepository.deleteOne(db, appSettingId);

    await this.hooks.runPostHooks('delete', member, db, { appSetting, itemId });

    return result;
  }

  async get(db: DBConnection, actor: Actor, itemId: string, appSettingId: UUID) {
    // get app setting is allowed to readers
    await this.itemService.get(db, actor, itemId);

    return await this.appSettingRepository.getOneOrThrow(db, appSettingId);
  }

  async getForItem(db: DBConnection, actor: Actor, itemId: string, name?: string) {
    // item can be public
    // get app setting is allowed to readers
    await this.itemService.get(db, actor, itemId);

    return this.appSettingRepository.getForItem(db, itemId, name);
  }

  async copyForItem(db: DBConnection, actor: Actor, original: Item, copy: Item) {
    if (!actor) {
      throw new UnauthorizedMember();
    }
    try {
      const appSettings = await this.getForItem(db, actor, original.id);
      const newAppSettings: AppSetting[] = [];
      for (const appSetting of appSettings) {
        const copyData = {
          name: appSetting.name,
          data: appSetting.data,
          itemId: copy.id,
          creator: { id: actor.id },
        };
        await this.hooks.runPreHooks('copyMany', actor, db, {
          appSettings,
          originalItemId: original.id,
          copyItemId: copy.id,
        });
        const newSetting = await this.appSettingRepository.addOne(db, {
          itemId: copy.id,
          memberId: appSetting.creator?.id,
          appSetting: copyData,
        });
        newAppSettings.push(newSetting);
      }
      await this.hooks.runPostHooks('copyMany', actor, db, {
        appSettings: newAppSettings,
        originalItemId: original.id,
        copyItemId: copy.id,
      });
    } catch (err) {
      console.error(err);
    }
  }
}
