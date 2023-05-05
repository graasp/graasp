import { In } from 'typeorm';

import { ResultOf } from '@graasp/sdk';

import { AppDataSource } from '../../../../../plugins/datasource';
import { mapById } from '../../../../utils';
import { ManyItemsGetFilter, SingleItemGetFilter } from '../interfaces/request';
import { AppAction } from './appAction';
import { InputAppAction } from './interfaces/app-action';

export const AppActionRepository = AppDataSource.getRepository(AppAction).extend({
  async post(itemId: string, memberId: string, body: Partial<InputAppAction>): Promise<AppAction> {
    const created = await this.insert({
      ...body,
      item: { id: itemId },
      member: { id: memberId },
    });

    // TODO: better solution?
    // query builder returns creator as id and extra as string
    return this.get(created.identifiers[0].id);
  },

  patch(itemId: string, appActionId: string, body: Partial<AppAction>): Promise<void> {
    return this.createQueryBuilder('appAction').update({ id: appActionId, itemId }, body);
  },

  deleteOne(itemId: string, appActionId: string): Promise<void> {
    return this.delete(appActionId);
  },

  async get(id: string): Promise<AppAction | null> {
    return this.findOneBy({ id });
  },

  getForItem(itemId: string, filters: SingleItemGetFilter): Promise<AppAction[]> {
    const { memberId } = filters;
    return this.findBy({ item: { id: itemId }, member: { id: memberId } });
  },

  async getForManyItems(
    itemIds: string[],
    filters: ManyItemsGetFilter,
  ): Promise<ResultOf<AppAction[]>> {
    const { memberId } = filters;

    const appActions = await this.find({where:{ item: { id: In(itemIds) }, member: { id: memberId }}, relations:{item:true} });
    return mapById({
      keys: itemIds,
      findElement: (id) => appActions.filter(({ item }) => item.id === id),
    });
  },
});
