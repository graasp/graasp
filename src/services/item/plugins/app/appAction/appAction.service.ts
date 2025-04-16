import { eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { type DBConnection } from '../../../../../drizzle/db';
import { appActionsTable } from '../../../../../drizzle/schema';
import { AppActionWithItemAndAccount } from '../../../../../drizzle/types';
import { AuthenticatedUser } from '../../../../../types';
import { AuthorizationService } from '../../../../authorization';
import { ItemRepository } from '../../../item.repository';
import { ManyItemsGetFilter, SingleItemGetFilter } from '../interfaces/request';
import { InputAppAction } from './appAction.interface';
import { AppActionRepository } from './appAction.repository';
import { AppActionNotAccessible } from './errors';

@singleton()
export class AppActionService {
  private readonly appActionRepository: AppActionRepository;
  private readonly itemRepository: ItemRepository;
  private readonly authorizationService: AuthorizationService;

  constructor(
    authorizationService: AuthorizationService,
    appActionRepository: AppActionRepository,
    itemRepository: ItemRepository,
  ) {
    this.authorizationService = authorizationService;
    this.appActionRepository = appActionRepository;
    this.itemRepository = itemRepository;
  }

  async getOne(
    dbConnection: DBConnection,
    actionId: string,
  ): Promise<AppActionWithItemAndAccount | undefined> {
    return await dbConnection.query.appActionsTable.findFirst({
      where: eq(appActionsTable.id, actionId),
      with: { account: true, item: true },
    });
  }

  async post(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    body: InputAppAction,
  ): Promise<AppActionWithItemAndAccount> {
    // check item exists? let post fail?
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // posting an app action is allowed to readers
    await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Read,
      account,
      item,
    );

    const rawAppActions = await this.appActionRepository.addOne(dbConnection, {
      itemId,
      accountId: account.id,
      appAction: body,
    });

    const appAction = await this.getOne(dbConnection, rawAppActions[0].id);
    if (!appAction) {
      throw new Error('expected to get app action on creation');
    }

    return appAction;
  }

  async getForItem(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    filters: SingleItemGetFilter,
  ) {
    // check item exists
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // posting an app action is allowed to readers
    const { itemMembership } = await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Read,
      account,
      item,
    );
    const permission = itemMembership?.permission;
    let { accountId: fMemberId } = filters;

    // can read only own app action if not admin
    if (permission !== PermissionLevel.Admin) {
      if (!fMemberId) {
        fMemberId = account.id;
      } else if (fMemberId !== account.id) {
        throw new AppActionNotAccessible();
      }
    }

    return this.appActionRepository.getForItem(dbConnection, itemId, {
      accountId: fMemberId,
    });
  }

  async getForManyItems(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemIds: string[],
    filters: ManyItemsGetFilter,
  ) {
    // check item exists
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemIds[0]);

    // posting an app action is allowed to readers
    const { itemMembership } = await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Read,
      account,
      item,
    );
    const permission = itemMembership?.permission;
    const { accountId: fMemberId } = filters;

    // can read only own app action if not admin
    if (permission !== PermissionLevel.Admin) {
      if (fMemberId && fMemberId !== account.id) {
        throw new AppActionNotAccessible();
      }
    }

    return this.appActionRepository.getForManyItems(dbConnection, itemIds, filters);
  }
}
