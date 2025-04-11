import { and, eq, inArray } from 'drizzle-orm/sql';

import { ResultOf } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { appActionsTable } from '../../../../../drizzle/schema';
import { AppActionWithItemAndAccount } from '../../../../../drizzle/types';
import { IllegalArgumentException } from '../../../../../repositories/errors';
import { mapById } from '../../../../utils';
import { ManyItemsGetFilter, SingleItemGetFilter } from '../interfaces/request';
import { InputAppAction } from './appAction.interface';

type CreateAppActionBody = {
  appAction: InputAppAction;
  itemId: string;
  accountId: string;
};

export class AppActionRepository {
  async addOne(dbConnection: DBConnection, { itemId, accountId, appAction }: CreateAppActionBody) {
    return await dbConnection
      .insert(appActionsTable)
      .values({
        ...appAction,
        itemId,
        accountId,
      })
      .returning();
  }

  async getOne(dbConnection: DBConnection, id: string) {
    return await dbConnection.query.appActionsTable.findFirst({
      where: eq(appActionsTable.id, id),
      with: { account: true },
    });
  }

  async getForItem(
    dbConnection: DBConnection,
    itemId: string,
    filters: SingleItemGetFilter,
  ): Promise<AppActionWithItemAndAccount[]> {
    if (!itemId) {
      throw new IllegalArgumentException('The itemId must be defined');
    }

    const { accountId } = filters;
    return await dbConnection.query.appActionsTable.findMany({
      where: and(
        eq(appActionsTable.itemId, itemId),
        accountId ? eq(appActionsTable.accountId, accountId) : undefined,
      ),
      with: { account: true, item: true },
    });
  }

  async getForManyItems(
    dbConnection: DBConnection,
    itemIds: string[],
    filters: ManyItemsGetFilter,
  ): Promise<ResultOf<AppActionWithItemAndAccount[]>> {
    const { accountId } = filters;

    if (itemIds.length === 0) {
      throw new IllegalArgumentException('The itemIds must not be empty!');
    }

    // here it is ok to have some app actions where the item or the member are null (because of missing or soft-deleted relations)
    const result = await dbConnection.query.appActionsTable.findMany({
      where: and(
        inArray(appActionsTable.itemId, itemIds),
        accountId ? eq(appActionsTable.accountId, accountId) : undefined,
      ),
      with: { item: true, account: true },
    });
    // todo: should use something like:
    // but this does not work. Maybe related to the placement of the IN ?
    // const appActions = await this.createQueryBuilder('actions')
    //   .innerJoinAndSelect('actions.item', 'item', 'actions.item IN (:...itemIds)', { itemIds })
    //   .innerJoinAndSelect('actions.member', 'member', 'actions.member = :memberId', { memberId })
    //   .getMany();
    return mapById({
      keys: itemIds,
      findElement: (id) => result.filter(({ item }) => item.id === id),
    });
  }
}
