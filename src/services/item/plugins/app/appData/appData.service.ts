import { inject, singleton } from 'tsyringe';

import {
  AppDataVisibility,
  FileItemType,
  PermissionLevel,
  PermissionLevelCompare,
  PermissionLevelOptions,
  UUID,
} from '@graasp/sdk';

import { FILE_ITEM_TYPE_DI_KEY } from '../../../../../di/constants';
import { DBConnection } from '../../../../../drizzle/db';
import { AppDataRaw, Item, ItemMembershipRaw } from '../../../../../drizzle/types';
import { AuthenticatedUser, MaybeUser } from '../../../../../types';
import HookManager from '../../../../../utils/hook';
import { AuthorizationService } from '../../../../authorization';
import { ItemRepository } from '../../../item.repository';
import {
  AppDataNotAccessible,
  AppDataNotFound,
  PreventUpdateAppDataFile,
  PreventUpdateOtherAppData,
} from './errors';
import { InputAppData } from './interfaces/app-data';
import { AppDataRepository } from './repository';

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
  private fileItemType: FileItemType;
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

  async post(db: DBConnection, account: AuthenticatedUser, itemId: string, body: InputAppData) {
    // check item exists? let post fail?
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // posting an app data is allowed to readers
    await this.authorizationService.validatePermission(db, PermissionLevel.Read, account, item);

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

    await this.hooks.runPreHooks('post', account, db, {
      appData: body,
      itemId,
    });

    const { id: appDataId } = await this.appDataRepository.addOne(db, {
      appData: completeData,
      itemId,
      actorId: account.id,
    });
    if (appDataId) {
      const appData = await this.appDataRepository.getOne(db, appDataId);
      if (appData) {
        await this.hooks.runPostHooks('post', account, db, {
          appData,
          itemId,
        });
      }
      return appData;
    }
  }

  async patch(
    db: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    appDataId: string,
    body: Partial<AppDataRaw>,
  ) {
    // check item exists? let post fail?
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // patching requires at least read
    const { itemMembership: inheritedMembership } =
      await this.authorizationService.validatePermission(db, PermissionLevel.Read, account, item);

    const currentAppData = await this.appDataRepository.getOne(db, appDataId);

    if (!currentAppData) {
      throw new AppDataNotFound(appDataId);
    }

    // prevent patch on app data file
    if (currentAppData?.data && currentAppData.data[this.fileItemType]) {
      throw new PreventUpdateAppDataFile(currentAppData.id);
    }

    // patch own or is admin
    const isValid = await this.validateAppDataPermission(
      db,
      account,
      currentAppData,
      PermissionLevel.Write,
      inheritedMembership,
    );
    if (!isValid) {
      throw new PreventUpdateOtherAppData(appDataId);
    }

    await this.hooks.runPreHooks('patch', account, db, {
      appData: { ...body, id: appDataId },
      itemId,
    });

    await this.appDataRepository.updateOne(db, appDataId, body);
    const appData = await this.appDataRepository.getOne(db, appDataId);
    if (appData) {
      await this.hooks.runPostHooks('patch', account, db, {
        appData,
        itemId,
      });
    }
    return appData;
  }

  async deleteOne(db: DBConnection, account: AuthenticatedUser, itemId: string, appDataId: string) {
    // check item exists? let post fail?
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // delete an app data is allowed to readers
    const { itemMembership: inheritedMembership } =
      await this.authorizationService.validatePermission(db, PermissionLevel.Read, account, item);

    const appData = await this.appDataRepository.getOne(db, appDataId);

    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }

    // patch own or is admin
    await this.validateAppDataPermission(
      db,
      account,
      appData,
      PermissionLevel.Admin,
      inheritedMembership,
    );

    await this.hooks.runPreHooks('delete', account, db, {
      appDataId,
      itemId,
    });

    await this.appDataRepository.deleteOne(db, appDataId);

    await this.hooks.runPostHooks('delete', account, db, {
      appData,
      itemId,
    });

    return appData;
  }

  async get(db: DBConnection, account: AuthenticatedUser, item: Item, appDataId: UUID) {
    const { itemMembership } = await this.authorizationService.validatePermission(
      db,
      PermissionLevel.Read,
      account,
      item,
    );

    const appData = await this.appDataRepository.getOne(db, appDataId);

    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }

    if (
      !this.validateAppDataPermission(db, account, appData, PermissionLevel.Read, itemMembership)
    ) {
      throw new AppDataNotAccessible({ appDataId, accountId: account.id });
    }

    return appData;
  }

  async getForItem(db: DBConnection, account: MaybeUser, itemId: string, type?: string) {
    // check item exists? let post fail?
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // posting an app data is allowed to readers
    const { itemMembership } = await this.authorizationService.validatePermission(
      db,
      PermissionLevel.Read,
      account,
      item,
    );

    return this.appDataRepository.getForItem(
      db,
      itemId,
      { accountId: account?.id, type },
      itemMembership?.permission,
    );
  }

  // TODO: check
  private validateAppDataPermission(
    db: DBConnection,
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
