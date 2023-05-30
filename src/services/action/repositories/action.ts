import { UUID } from '@graasp/sdk';

import { AppDataSource } from '../../../plugins/datasource';
import { DEFAULT_ACTIONS_SAMPLE_SIZE, VIEW_UNKNOWN_NAME } from '../constants/constants';
import { Action } from '../entities/action';
import {
  AggregateAttribute,
  AggregateFunctionType,
  buildAggregateExpression,
  convertToExpressionName,
} from '../utils/actions';

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
    filters?: { sampleSize?: number; view?: string; memberId?: UUID },
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

    if (filters?.memberId) {
      query.andWhere('member_id = :memberId', { memberId: filters.memberId });
    }

    return query.getMany();
  },

  /**
   * Get aggregation of random actions matching the given itemPath and following the provided aggregate rules.
   * @param itemPath path of the item whose actions are retrieved
   * @param filters.sampleSize number of actions to retrieve
   * @param filters.view get actions only for a given view
   */
  async getAggregationForItem(
    itemId: UUID,
    filters?: { sampleSize?: number; view?: string; type?: string },
    countGroupBy?: AggregateAttribute[],
    aggregateFunction?: AggregateFunctionType,
    aggregateMetric?: AggregateAttribute,
    aggregateBy?: AggregateAttribute[],
  ): Promise<unknown[]> {
    const size = filters?.sampleSize ?? DEFAULT_ACTIONS_SAMPLE_SIZE;
    const view = filters?.view ?? VIEW_UNKNOWN_NAME;
    const type = filters?.type;

    // Get the actionCount from the first stage aggregation.
    const subquery = this.createQueryBuilder('action').select('COUNT(*)', 'actionCount');
    countGroupBy?.forEach((attribute) => {
      const columnName = convertToExpressionName(attribute);
      subquery.addSelect(columnName, attribute).addGroupBy(columnName);
    });

    // Filtering.
    subquery.where('action.item_path <@ :path').where('action.view = :view').limit(size);
    if (type) {
      subquery.andWhere('action.type = :type');
    }

    // Second stage aggregation.
    const query = AppDataSource.createQueryBuilder()
      .addSelect(
        buildAggregateExpression('subquery', aggregateFunction, aggregateMetric),
        'aggregateResult',
      )
      .from('(' + subquery.getQuery() + ')', 'subquery')
      .setParameter('path', itemId)
      .setParameter('view', view);
    if (type) {
      query.setParameter('type', type);
    }

    aggregateBy?.forEach((attribute) => {
      const expression = 'subquery.' + '"' + attribute + '"';
      query.addSelect(expression).addGroupBy(expression);
    });

    return query.getRawMany();
  },
});
