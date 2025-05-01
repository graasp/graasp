import { inject, singleton } from 'tsyringe';

import {
  AppDataVisibility,
  type FileItemType,
  PermissionLevel,
  PermissionLevelCompare,
  PermissionLevelOptions,
  UUID,
} from '@graasp/sdk';

import { FILE_ITEM_TYPE_DI_KEY } from '../../../../../di/constants';
import { type DBConnection } from '../../../../../drizzle/db';
import { AppDataRaw, ItemMembershipRaw, ItemRaw } from '../../../../../drizzle/types';
import { AuthenticatedUser, MaybeUser } from '../../../../../types';
import HookManager from '../../../../../utils/hook';
import { AuthorizationService } from '../../../../authorization';
import { ItemRepository } from '../../../item.repository';
import { AppDataRepository } from './appData.repository';
import {
  AppDataNotAccessible,
  AppDataNotFound,
  PreventUpdateAppDataFile,
  PreventUpdateOtherAppData,
} from './errors';
import { InputAppData } from './interfaces/app-data';

const ownAppDataAbility = (appData: AppDataRaw, actor: MaybeUser) => {
  if (!actor) {
    return false;
  }
  return appData.creatorId === actor.id;
};

const itemVisibilityAppDataAbility = (
  appData: AppDataRaw,
  permission: PermissionLevelOptions,
  memberPermission?: PermissionLevelOptions,
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

      return PermissionLevelCompare.gte(memberPermission, permission);
    }
  }
};

@singleton()
export class AppDataService {
  private readonly fileItemType: FileItemType;
  private readonly itemRepository: ItemRepository;
  private readonly appDataRepository: AppDataRepository;
  private readonly authorizationService: AuthorizationService;

  hooks = new HookManager<{
    post: {
      pre: { appData: InputAppData; itemId: string };
      post: { appData: AppDataRaw; itemId: string };
    };
    patch: {
      pre: { appData: Partial<AppDataRaw>; itemId: string };
      post: { appData: AppDataRaw; itemId: string };
    };
    delete: {
      pre: { appDataId: string; itemId: string };
      post: { appData: AppDataRaw; itemId: string };
    };
  }>();

  constructor(
    @inject(FILE_ITEM_TYPE_DI_KEY) fileItemType: FileItemType,
    authorizationService: AuthorizationService,
    itemRepository: ItemRepository,
    appDataRepository: AppDataRepository,
  ) {
    this.fileItemType = fileItemType;
    this.itemRepository = itemRepository;
    this.authorizationService = authorizationService;
    this.appDataRepository = appDataRepository;
  }

  async post(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    body: InputAppData,
  ) {
    // check item exists? let post fail?
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // posting an app data is allowed to readers
    await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Read,
      account,
      item,
    );

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

    await this.hooks.runPreHooks('post', account, dbConnection, {
      appData: body,
      itemId,
    });

    const { id: appDataId } = await this.appDataRepository.addOne(dbConnection, {
      appData: completeData,
      itemId,
      actorId: account.id,
    });

    // get relations
    const appData = await this.appDataRepository.getOne(dbConnection, appDataId);
    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }
    await this.hooks.runPostHooks('post', account, dbConnection, {
      appData,
      itemId,
    });
    return appData;
  }

  async patch(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    appDataId: string,
    body: Partial<AppDataRaw>,
  ) {
    // check item exists? let post fail?
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // patching requires at least read
    const { itemMembership: inheritedMembership } =
      await this.authorizationService.validatePermission(
        dbConnection,
        PermissionLevel.Read,
        account,
        item,
      );

    const currentAppData = await this.appDataRepository.getOne(dbConnection, appDataId);

    if (!currentAppData) {
      throw new AppDataNotFound(appDataId);
    }

    // prevent patch on app data file
    if (currentAppData?.data && currentAppData.data[this.fileItemType]) {
      throw new PreventUpdateAppDataFile(currentAppData.id);
    }

    // patch own or is admin
    const isValid = await this.validateAppDataPermission(
      account,
      currentAppData,
      PermissionLevel.Write,
      inheritedMembership,
    );
    if (!isValid) {
      throw new PreventUpdateOtherAppData(appDataId);
    }

    await this.hooks.runPreHooks('patch', account, dbConnection, {
      appData: { ...body, id: appDataId },
      itemId,
    });

    await this.appDataRepository.updateOne(dbConnection, appDataId, body);

    // get relations
    const appData = await this.appDataRepository.getOne(dbConnection, appDataId);
    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }
    await this.hooks.runPostHooks('patch', account, dbConnection, {
      appData,
      itemId,
    });
    return appData;
  }

  async deleteOne(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    appDataId: string,
  ) {
    // check item exists? let post fail?
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // delete an app data is allowed to readers
    const { itemMembership: inheritedMembership } =
      await this.authorizationService.validatePermission(
        dbConnection,
        PermissionLevel.Read,
        account,
        item,
      );

    const appData = await this.appDataRepository.getOne(dbConnection, appDataId);

    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }

    // patch own or is admin
    await this.validateAppDataPermission(
      account,
      appData,
      PermissionLevel.Admin,
      inheritedMembership,
    );

    await this.hooks.runPreHooks('delete', account, dbConnection, {
      appDataId,
      itemId,
    });

    await this.appDataRepository.deleteOne(dbConnection, appDataId);

    await this.hooks.runPostHooks('delete', account, dbConnection, {
      appData,
      itemId,
    });

    return appData;
  }

  async get(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    item: ItemRaw,
    appDataId: UUID,
  ) {
    const { itemMembership } = await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Read,
      account,
      item,
    );

    const appData = await this.appDataRepository.getOne(dbConnection, appDataId);

    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }

    if (!this.validateAppDataPermission(account, appData, PermissionLevel.Read, itemMembership)) {
      throw new AppDataNotAccessible({ appDataId, accountId: account.id });
    }

    return appData;
  }

  async getForItem(dbConnection: DBConnection, account: MaybeUser, itemId: string, type?: string) {
    // check item exists? let post fail?
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // posting an app data is allowed to readers
    const { itemMembership } = await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Read,
      account,
      item,
    );

    return this.appDataRepository.getForItem(
      dbConnection,
      itemId,
      { accountId: account?.id, type },
      itemMembership?.permission,
    );
  }

  private validateAppDataPermission(
    actor: MaybeUser,
    appData: AppDataRaw,
    permission: PermissionLevelOptions,
    inheritedMembership?: ItemMembershipRaw | null,
  ) {
    const isValid =
      ownAppDataAbility(appData, actor) ||
      itemVisibilityAppDataAbility(appData, permission, inheritedMembership?.permission) ||
      (inheritedMembership &&
        PermissionLevelCompare.gte(inheritedMembership.permission, permission));

    return isValid;
  }
}
