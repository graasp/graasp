import { UUID } from '@graasp/sdk';

import { AppDataSource } from '../../../plugins/datasource';
import { DEFAULT_ACTIONS_SAMPLE_SIZE } from '../constants/constants';
import { Action } from '../entities/action';

/**
 * Database's first layer of abstraction for Actions
 */
export const ActionRepository = AppDataSource.getRepository(Action).extend({
  /**
   * Create given action and return it.
   * @param action Action to create
   */
  async postMany(actions: Pick<Action, 'member' | 'type'>[]): Promise<void> {
    // save action
    for (const action of actions) {
      await this.insert(action);
    }
  },

  /**
   * Delete actions matching the given `memberId`. Return actions, or `null`, if delete has no effect.
   * @param memberId ID of the member whose actions are deleted
   */
  async deleteAllForMember(memberId: string): Promise<Action[]> {
    return this.createQueryBuilder('action')
      .where('action.member_id = :memberId', { memberId })
      .execute();
  },

  /**
   * Get random actions matching the given itemPath and below
   * @param itemPath path of the item whose actions are retrieved
   * @param filters.sampleSize number of actions to retrieve
   * @param filters.view get actions only for a given view
   */
  async getForItem(
    itemPath: UUID,
    filters?: { sampleSize?: number; view?: string },
  ): Promise<Action[]> {
    const size = filters?.sampleSize ?? DEFAULT_ACTIONS_SAMPLE_SIZE;

    const query = this.createQueryBuilder('action')
      .leftJoinAndSelect('action.item', 'item')
      .leftJoinAndSelect('action.member', 'member')
      .where('item.path <@ :path', { path: itemPath })
      .limit(size);

    if (filters?.view) {
      query.andWhere('view = :view', { view: filters.view });
    }

    return query.getMany();
  },
});
