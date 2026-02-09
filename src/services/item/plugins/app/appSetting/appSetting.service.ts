import { singleton } from 'tsyringe';

import { type UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../../drizzle/db';
import type { AppSettingInsertDTO, AppSettingRaw } from '../../../../../drizzle/types';
import type { AuthenticatedUser, MaybeUser } from '../../../../../types';
import { UnauthorizedMember } from '../../../../../utils/errors';
import HookManager from '../../../../../utils/hook';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import type { ItemRaw } from '../../../item';
import { AppSettingRepository } from './appSetting.repository';

@singleton()
export class AppSettingService {
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly appSettingRepository: AppSettingRepository;

  hooks = new HookManager<{
    patch: {
      pre: { appSetting: Partial<AppSettingRaw>; itemId: string };
      post: { appSetting: AppSettingRaw; itemId: string };
    };
    delete: {
      pre: { appSettingId: string; itemId: string };
      post: { appSetting: AppSettingRaw; itemId: string };
    };
    copyMany: {
      pre: {
        appSettings: AppSettingRaw[];
        originalItemId: string;
        copyItemId: string;
      };
      post: {
        appSettings: AppSettingRaw[];
        originalItemId: string;
        copyItemId: string;
      };
    };
  }>();

  constructor(
    authorizedItemService: AuthorizedItemService,
    appSettingRepository: AppSettingRepository,
  ) {
    this.authorizedItemService = authorizedItemService;
    this.appSettingRepository = appSettingRepository;
  }

  async post(
    dbConnection: DBConnection,
    member: AuthenticatedUser,
    itemId: string,
    body: Omit<AppSettingInsertDTO, 'itemId' | 'memberId'>,
  ) {
    // posting an app setting is allowed to admin only
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: member.id,
      itemId,
      permission: 'admin',
    });

    const appSetting = await this.appSettingRepository.addOne(dbConnection, {
      ...body,
      itemId,
      creatorId: member.id,
    });

    return appSetting;
  }

  async patch(
    dbConnection: DBConnection,
    member: AuthenticatedUser,
    itemId: string,
    appSettingId: string,
    body: Partial<AppSettingInsertDTO>,
  ) {
    // patching requires admin rights
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: member.id,
      itemId,
      permission: 'admin',
    });

    await this.hooks.runPreHooks('patch', member, dbConnection, {
      appSetting: { ...body, id: appSettingId },
      itemId,
    });

    const appSetting = await this.appSettingRepository.updateOne(dbConnection, appSettingId, body);
    await this.hooks.runPostHooks('patch', member, dbConnection, {
      appSetting,
      itemId,
    });
    return appSetting;
  }

  async deleteOne(
    dbConnection: DBConnection,
    member: AuthenticatedUser,
    itemId: string,
    appSettingId: string,
  ) {
    // delete an app data is allowed to admins
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: member.id,
      itemId,
      permission: 'admin',
    });

    const appSetting = await this.appSettingRepository.getOneOrThrow(dbConnection, appSettingId);

    await this.hooks.runPreHooks('delete', member, dbConnection, {
      appSettingId,
      itemId,
    });

    await this.appSettingRepository.deleteOne(dbConnection, appSettingId);

    await this.hooks.runPostHooks('delete', member, dbConnection, { appSetting, itemId });

    return appSetting;
  }

  async get(dbConnection: DBConnection, maybeUser: MaybeUser, itemId: string, appSettingId: UUID) {
    // get app setting is allowed to readers
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });

    return await this.appSettingRepository.getOneOrThrow(dbConnection, appSettingId);
  }

  async getForItem(
    dbConnection: DBConnection,
    maybeUser: MaybeUser,
    itemId: string,
    name?: string,
  ) {
    // item can be public
    // get app setting is allowed to readers
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });

    return this.appSettingRepository.getForItem(dbConnection, itemId, name);
  }

  async copyForItem(
    dbConnection: DBConnection,
    actor: MaybeUser,
    original: ItemRaw,
    copyItemId: ItemRaw['id'],
  ) {
    if (!actor) {
      throw new UnauthorizedMember();
    }
    try {
      const appSettings = await this.getForItem(dbConnection, actor, original.id);
      const newAppSettings: AppSettingRaw[] = [];
      for (const appSetting of appSettings) {
        const copyData = {
          name: appSetting.name,
          data: appSetting.data,
          itemId: copyItemId,
          creator: { id: actor.id },
        };
        const newSetting = await this.appSettingRepository.addOne(dbConnection, {
          ...copyData,
          itemId: copyItemId,
          creatorId: appSetting.creatorId,
        });
        newAppSettings.push(newSetting);
      }
      await this.hooks.runPostHooks('copyMany', actor, dbConnection, {
        appSettings: newAppSettings,
        originalItemId: original.id,
        copyItemId: copyItemId,
      });
    } catch (err) {
      console.error(err);
    }
  }
}
