import { singleton } from 'tsyringe';

import { MultipartFile } from '@fastify/multipart';

import { AppDataVisibility, ItemType, PermissionLevelCompare, type UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../../drizzle/db';
import type { AppDataRaw, ItemMembershipRaw, ItemRaw } from '../../../../../drizzle/types';
import { BaseLogger } from '../../../../../logger';
import type { AuthenticatedUser, MaybeUser, PermissionLevel } from '../../../../../types';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import FileService from '../../../../file/file.service';
import { AppDataRepository } from './appData.repository';
import { AppDataFileServiceAdapter } from './appDataFileServiceAdapter';
import {
  AppDataNotAccessible,
  AppDataNotFound,
  PreventUpdateAppDataFile,
  PreventUpdateOtherAppData,
} from './errors';
import { AppDataFileService } from './interfaces/appDataFileService';

const ownAppDataAbility = (appData: AppDataRaw, actor: MaybeUser) => {
  if (!actor) {
    return false;
  }
  return appData.creatorId === actor.id;
};

const itemVisibilityAppDataAbility = (
  appData: AppDataRaw,
  permission: PermissionLevel,
  memberPermission?: PermissionLevel,
) => {
  if (appData.visibility === AppDataVisibility.Item) {
    // can always read an app data with visibility item
    if (permission === 'read') {
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
  private readonly appDataRepository: AppDataRepository;
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly appDataFileService: AppDataFileService;

  constructor(
    authorizedItemService: AuthorizedItemService,
    appDataRepository: AppDataRepository,
    fileService: FileService,
    log: BaseLogger,
  ) {
    this.authorizedItemService = authorizedItemService;
    this.appDataRepository = appDataRepository;
    this.appDataFileService = new AppDataFileServiceAdapter(fileService, log);
  }

  async post(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    body: {
      id?: UUID;
      data: { [key: string]: unknown };
      type: string;
      visibility?: AppDataVisibility;
      accountId?: string;
      /**
       * @deprecated use accountId - legacy to work with old apps
       */
      memberId?: string;
    },
  ) {
    // posting an app data is allowed to readers
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      permission: 'read',
      accountId: account.id,
      itemId,
    });

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

    return appData;
  }

  async patch(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    appDataId: string,
    body: Partial<AppDataRaw>,
  ) {
    // patching requires at least read
    const { itemMembership: inheritedMembership } =
      await this.authorizedItemService.getPropertiesForItemById(dbConnection, {
        permission: 'read',
        accountId: account.id,
        itemId,
      });

    const currentAppData = await this.appDataRepository.getOne(dbConnection, appDataId);

    if (!currentAppData) {
      throw new AppDataNotFound(appDataId);
    }

    // prevent patch on app data file
    if (currentAppData?.data && currentAppData.data[ItemType.FILE]) {
      throw new PreventUpdateAppDataFile(currentAppData.id);
    }

    // patch own or is admin
    const isValid = await this.validateAppDataPermission(
      account,
      currentAppData,
      'write',
      inheritedMembership,
    );
    if (!isValid) {
      throw new PreventUpdateOtherAppData(appDataId);
    }

    await this.appDataRepository.updateOne(dbConnection, appDataId, body);

    // get relations
    const appData = await this.appDataRepository.getOne(dbConnection, appDataId);
    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }

    return appData;
  }

  async deleteOne(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    appDataId: string,
  ) {
    // delete an app data is allowed to readers
    const { itemMembership: inheritedMembership } =
      await this.authorizedItemService.getPropertiesForItemById(dbConnection, {
        permission: 'read',
        accountId: account.id,

        itemId,
      });

    const appData = await this.appDataRepository.getOne(dbConnection, appDataId);

    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }

    // patch own or is admin
    await this.validateAppDataPermission(account, appData, 'admin', inheritedMembership);

    await this.appDataRepository.deleteOne(dbConnection, appDataId);

    // delete related app file data
    await this.appDataFileService.deleteOne(appData);

    return appData;
  }

  async get(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    item: ItemRaw,
    appDataId: UUID,
  ) {
    const { itemMembership } = await this.authorizedItemService.getPropertiesForItem(dbConnection, {
      permission: 'read',
      accountId: account.id,
      item,
    });

    const appData = await this.appDataRepository.getOne(dbConnection, appDataId);

    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }

    if (!this.validateAppDataPermission(account, appData, 'read', itemMembership)) {
      throw new AppDataNotAccessible({ appDataId, accountId: account.id });
    }

    return appData;
  }

  async getForItem(
    dbConnection: DBConnection,
    maybeUser: MaybeUser,
    itemId: string,
    type?: string,
  ) {
    // posting an app data is allowed to readers
    const { itemMembership } = await this.authorizedItemService.getPropertiesForItemById(
      dbConnection,
      { permission: 'read', accountId: maybeUser?.id, itemId },
    );

    return this.appDataRepository.getForItem(
      dbConnection,
      itemId,
      { accountId: maybeUser?.id, type },
      itemMembership?.permission,
    );
  }

  private validateAppDataPermission(
    actor: MaybeUser,
    appData: AppDataRaw,
    permission: PermissionLevel,
    inheritedMembership?: ItemMembershipRaw | null,
  ) {
    const isValid =
      ownAppDataAbility(appData, actor) ||
      itemVisibilityAppDataAbility(appData, permission, inheritedMembership?.permission) ||
      (inheritedMembership &&
        PermissionLevelCompare.gte(inheritedMembership.permission, permission));

    return isValid;
  }

  async upload(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    file: MultipartFile,
    item: ItemRaw,
  ) {
    const appDataValue = await this.appDataFileService.upload(account, file, item);

    const { id: appDataId } = await this.appDataRepository.addOne(dbConnection, {
      itemId: item.id,
      actorId: account.id,
      appData: appDataValue,
    });

    // get relations
    const appData = await this.appDataRepository.getOne(dbConnection, appDataId);
    if (!appData) {
      throw new AppDataNotFound(appDataId);
    }

    return appData;
  }

  async download(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    { item, appDataId }: { item: ItemRaw; appDataId: AppDataRaw['id'] },
  ) {
    const appData = await this.get(dbConnection, account, item, appDataId);
    return await this.appDataFileService.download(appData);
  }
}
