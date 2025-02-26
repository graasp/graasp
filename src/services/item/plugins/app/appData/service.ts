import { inject, singleton } from 'tsyringe';

import { AppDataVisibility, FileItemType, PermissionLevel, UUID } from '@graasp/sdk';

import { FILE_ITEM_TYPE_DI_KEY } from '../../../../../di/constants';
import { DBConnection } from '../../../../../drizzle/db';
import HookManager from '../../../../../utils/hook';
import { Account } from '../../../../account/entities/account';
import { AuthorizationService } from '../../../../authorization';
import { ItemMembership } from '../../../../itemMembership/entities/ItemMembership';
import { Actor } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemRepository } from '../../../repository';
import { AppData } from './appData';
import {
  AppDataNotAccessible,
  AppDataNotFound,
  PreventUpdateAppDataFile,
  PreventUpdateOtherAppData,
} from './errors';
import { InputAppData } from './interfaces/app-data';
import { AppDataRepository } from './repository';

const ownAppDataAbility = (appData: AppData, actor: Actor) => {
  if (!appData.creator || !actor) {
    return false;
  }
  return appData.creator.id === actor.id;
};

const itemVisibilityAppDataAbility = (
  appData: AppData,
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

@singleton()
export class AppDataService {
  private fileItemType: FileItemType;
  private readonly itemRepository: ItemRepository;
  private readonly appDataRepository: AppDataRepository;
  private readonly authorizationService: AuthorizationService;

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

  async post(db: DBConnection, account: Account, itemId: string, body: Partial<InputAppData>) {
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

    const appData = await this.appDataRepository.addOne(db, {
      appData: completeData,
      itemId,
      actorId: account.id,
    });
    await this.hooks.runPostHooks('post', account, db, {
      appData,
      itemId,
    });
    return appData;
  }

  async patch(
    db: DBConnection,
    account: Account,
    itemId: string,
    appDataId: string,
    body: Partial<AppData>,
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

    const appData = await this.appDataRepository.updateOne(db, appDataId, body);
    await this.hooks.runPostHooks('patch', account, db, {
      appData,
      itemId,
    });
    return appData;
  }

  async deleteOne(db: DBConnection, account: Account, itemId: string, appDataId: string) {
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

    const result = await this.appDataRepository.deleteOne(db, appDataId);

    await this.hooks.runPostHooks('delete', account, db, {
      appData,
      itemId,
    });

    return result;
  }

  async get(db: DBConnection, account: Account, item: Item, appDataId: UUID) {
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

  async getForItem(db: DBConnection, account: Account, itemId: string, type?: string) {
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
      { accountId: account.id, type },
      itemMembership?.permission,
    );
  }

  // TODO: check
  async validateAppDataPermission(
    db: DBConnection,
    actor: Actor,
    appData: AppData,
    permission: PermissionLevel,
    inheritedMembership?: ItemMembership | null,
  ) {
    const isValid =
      ownAppDataAbility(appData, actor) ||
      itemVisibilityAppDataAbility(appData, permission, inheritedMembership?.permission) ||
      (inheritedMembership &&
        permissionMapping[inheritedMembership.permission].includes(permission));

    return isValid;
  }
}
