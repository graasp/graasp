import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import HookManager from '../../../../../utils/hook';
import { Account } from '../../../../account/entities/account';
import { AuthorizationService } from '../../../../authorization';
import { ItemRepository } from '../../../repository';
import { ManyItemsGetFilter, SingleItemGetFilter } from '../interfaces/request';
import { AppAction } from './appAction';
import { AppActionNotAccessible } from './errors';
import { InputAppAction } from './interfaces/app-action';
import { AppActionRepository } from './repository';

@singleton()
export class AppActionService {
  private readonly appActionRepository: AppActionRepository;
  private readonly itemRepository: ItemRepository;
  private readonly authorizationService: AuthorizationService;

  hooks = new HookManager<{
    post: {
      pre: { appAction: Partial<InputAppAction>; itemId: string };
      post: { appAction: AppAction; itemId: string };
    };
  }>();

  constructor(authorizationService: AuthorizationService, appActionRepository, itemRepository) {
    this.authorizationService = authorizationService;
    this.appActionRepository = appActionRepository;
    this.itemRepository = itemRepository;
  }

  async post(db: DBConnection, account: Account, itemId: string, body: Partial<InputAppAction>) {
    // check item exists? let post fail?
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // posting an app action is allowed to readers
    await this.authorizationService.validatePermission(db, PermissionLevel.Read, account, item);

    const appAction = await this.appActionRepository.addOne(db, {
      itemId,
      accountId: account.id,
      appAction: body,
    });
    await this.hooks.runPostHooks('post', account, {
      appAction,
      itemId,
    });
    return appAction;
  }

  async getForItem(
    db: DBConnection,
    account: Account,
    itemId: string,
    filters: SingleItemGetFilter,
  ) {
    // check item exists
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    // posting an app action is allowed to readers
    const { itemMembership } =
      await this.authorizationService.this.authorizationService.validatePermission(
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

    return this.appActionRepository.getForItem(db, itemId, { accountId: fMemberId });
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
