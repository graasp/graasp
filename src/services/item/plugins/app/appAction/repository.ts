import { In } from 'typeorm';

import { AppDataSource } from '../../../../../plugins/datasource';
import { mapById } from '../../../../utils';
import { ManyItemsGetFilter, SingleItemGetFilter } from '../interfaces/request';
import { AppAction } from './appAction';
import { InputAppAction } from './interfaces/app-action';

export const AppActionRepository = AppDataSource.getRepository(AppAction).extend({
  async post(itemId: string, memberId: string, body: Partial<InputAppAction>) {
    const created = await this.insert({
      ...body,
      item: { id: itemId },
      member: { id: memberId },
    });

    // TODO: better solution?
    // query builder returns creator as id and extra as string
    return this.get(created.identifiers[0].id);
  },

  patch(itemId: string, appActionId: string, body: Partial<AppAction>) {
    return this.createQueryBuilder('appAction').update({ id: appActionId, itemId }, body);
  },

  deleteOne(itemId: string, appActionId: string) {
    return this.delete(appActionId);
  },

  async get(id: string) {
    return this.findOneBy({ id });
  },

  getForItem(itemId: string, filters: SingleItemGetFilter) {
    const { memberId } = filters;
    return this.findBy({ item: { id: itemId }, member: { id: memberId } });
  },

  async getForManyItems(itemIds: string[], filters: ManyItemsGetFilter) {
    const { memberId } = filters;

    const appActions = await this.findBy({ item: { id: In(itemIds) }, member: { id: memberId } });

    return mapById({
      keys: itemIds,
      findElement: (id) => appActions.filter(({ itemId }) => itemId === id),
    });
  },
});
