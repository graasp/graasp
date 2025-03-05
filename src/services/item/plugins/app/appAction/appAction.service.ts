import { eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { appActions } from '../../../../../drizzle/schema';
import { AppActionWithItemAndAccount } from '../../../../../drizzle/types';
import { AuthenticatedUser } from '../../../../../types';
import { AuthorizationService } from '../../../../authorization';
import { ItemRepository } from '../../../repository';
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
    db: DBConnection,
    actionId: string,
  ): Promise<AppActionWithItemAndAccount | undefined> {
    return db.query.appActions.findFirst({
      where: eq(appActions.id, actionId),
      with: { account: true, item: true },
    });
  }

  async post(
    db: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    body: InputAppAction,
  ): Promise<AppActionWithItemAndAccount> {
    // check item exists? let post fail?
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // posting an app action is allowed to readers
    await this.authorizationService.validatePermission(db, PermissionLevel.Read, account, item);

    const rawAppActions = await this.appActionRepository.addOne(db, {
      itemId,
      accountId: account.id,
      appAction: body,
    });

    const appAction = await this.getOne(db, rawAppActions[0].id);
    if (!appAction) {
      throw new Error('expected to get app action on creation');
    }
    return appAction;
  }

  async getForItem(
    db: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    filters: SingleItemGetFilter,
  ) {
    // check item exists
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // posting an app action is allowed to readers
    const { itemMembership } = await this.authorizationService.validatePermission(
      db,
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

    return this.appActionRepository.getForItem(db, itemId, {
      accountId: fMemberId,
    });
  }

  async getForManyItems(
    db: DBConnection,
    account: Account,
    itemIds: string[],
    filters: ManyItemsGetFilter,
  ) {
    // check item exists
    const item = await this.itemRepository.getOneOrThrow(db, itemIds[0]);

    // posting an app action is allowed to readers
    const { itemMembership } = await this.authorizationService.validatePermission(
      db,
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

    // TODO: get only memberId or with visibility
    return this.appActionRepository.getForManyItems(db, itemIds, filters);
  }
}
