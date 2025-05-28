import { eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { type DBConnection } from '../../../../../drizzle/db';
import { appActionsTable } from '../../../../../drizzle/schema';
import { AppActionWithItemAndAccount } from '../../../../../drizzle/types';
import { AuthenticatedUser } from '../../../../../types';
import { AuthorizedItemService } from '../../../../authorizedItem.service';
import { SingleItemGetFilter } from '../interfaces/request';
import { InputAppAction } from './appAction.interface';
import { AppActionRepository } from './appAction.repository';
import { AppActionNotAccessible } from './errors';

@singleton()
export class AppActionService {
  private readonly appActionRepository: AppActionRepository;
  private readonly authorizedItemService: AuthorizedItemService;

  constructor(
    authorizedItemService: AuthorizedItemService,
    appActionRepository: AppActionRepository,
  ) {
    this.authorizedItemService = authorizedItemService;
    this.appActionRepository = appActionRepository;
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
    // posting an app action is allowed to readers
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      permission: PermissionLevel.Read,
      actor: account,
      itemId,
    });

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
    // posting an app action is allowed to readers
    const { itemMembership } = await this.authorizedItemService.getPropertiesForItemById(
      dbConnection,
      { permission: PermissionLevel.Read, actor: account, itemId },
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
}
