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
    return this.findOne({ where: { id }, relations: { member: true } });
  },

  getForItem(itemId: string, filters: SingleItemGetFilter): Promise<AppAction[]> {
    const { memberId } = filters;
    return this.find({
      where: { item: { id: itemId }, member: { id: memberId } },
      relations: { member: true },
    });
  },

  getForMember(memberId: string): Promise<AppAction[]> {
    return this.createQueryBuilder('app_action')
      .where('app_action.member_id = :memberId', { memberId })
      .orderBy('app_action.created_at', 'DESC')
      .getMany();
  },

  async getForManyItems(
    itemIds: string[],
    filters: ManyItemsGetFilter,
  ): Promise<ResultOf<AppAction[]>> {
    const { memberId } = filters;

    // here it is ok to have some app actions where the item or the member are null (because of missing or soft-deleted relations)
    const appActions = await this.find({
      where: { item: { id: In(itemIds) }, member: { id: memberId } },
      relations: { item: true, member: true },
    });
    // todo: should use something like:
    // but this does not work. Maybe related to the placement of the IN ?
    // const appActions = await this.createQueryBuilder('actions')
    //   .innerJoinAndSelect('actions.item', 'item', 'actions.item IN (:...itemIds)', { itemIds })
    //   .innerJoinAndSelect('actions.member', 'member', 'actions.member = :memberId', { memberId })
    //   .getMany();
    return mapById({
      keys: itemIds,
      findElement: (id) => appActions.filter(({ item }) => item.id === id),
    });
  },
});
