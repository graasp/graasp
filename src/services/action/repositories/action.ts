import { EntityManager, Repository } from 'typeorm';

import { AggregateBy, AggregateFunction, AggregateMetric, CountGroupBy, UUID } from '@graasp/sdk';

import { AppDataSource } from '../../../plugins/datasource';
import { validateAggregateParameters } from '../../item/plugins/action/utils';
import { DEFAULT_ACTIONS_SAMPLE_SIZE } from '../constants/constants';
import { Action } from '../entities/action';
import { aggregateExpressionNames, buildAggregateExpression } from '../utils/actions';

export class ActionRepository {
  private repository: Repository<Action>;

  constructor(manager?: EntityManager) {
    if (manager) {
      this.repository = manager.getRepository(Action);
    } else {
      this.repository = AppDataSource.getRepository(Action);
    }
  }
  /**
   * Create given action and return it.
   * @param action Action to create
   */
  async postMany(actions: Pick<Action, 'member' | 'type'>[]): Promise<void> {
    await this.repository.createQueryBuilder().insert().into(Action).values(actions).execute();
  }

  /**
   * Delete actions matching the given `memberId`. Return actions, or `null`, if delete has no effect.
   * @param memberId ID of the member whose actions are deleted
   */
  async deleteAllForMember(memberId: string): Promise<void> {
    await this.repository
      .createQueryBuilder('action')
      .delete()
      .from(Action)
      .where('action.member_id = :memberId', { memberId })
      .execute();
  }

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

    const query = this.repository
      .createQueryBuilder('action')
      .leftJoinAndSelect('action.item', 'item')
      .leftJoinAndSelect('action.member', 'member')
      .where('item.path <@ :path', { path: itemPath })
      .orderBy('action.created_at', 'DESC')
      .limit(size);

    if (filters?.view) {
      query.andWhere('view = :view', { view: filters.view });
    }

    if (filters?.memberId) {
      query.andWhere('member_id = :memberId', { memberId: filters.memberId });
    }

    return query.getMany();
  }

  // TODO: improve parameters, it seems we can enforce some of them
  // TODO: improve return value -> avoid string
  /**
   * Get aggregation of random actions matching the given itemPath and following the provided aggregate rules.
   * @param itemPath path of the item whose actions are retrieved
   * @param filters.sampleSize number of actions to retrieve
   * @param filters.view get actions only for a given view
   */
  async getAggregationForItem(
    itemPath: UUID,
    filters?: { sampleSize?: number; view?: string; types?: string[] },
    countGroupBy?: CountGroupBy[],
    aggregateFunction?: AggregateFunction,
    aggregateMetric?: AggregateMetric,
    aggregateBy?: AggregateBy[],
  ): Promise<unknown[]> {
    // verify parameters
    validateAggregateParameters(countGroupBy!, aggregateFunction!, aggregateMetric!, aggregateBy);

    const size = filters?.sampleSize ?? DEFAULT_ACTIONS_SAMPLE_SIZE;
    const view = filters?.view ?? 'Unknown';
    const types = filters?.types;

    // Get the actionCount from the first stage aggregation.
    const subquery = this.repository.createQueryBuilder('action').select('COUNT(*)', 'actionCount');
    countGroupBy?.forEach((attribute) => {
      const columnName = aggregateExpressionNames[attribute];
      subquery.addSelect(columnName, attribute).addGroupBy(columnName);
    });

    // Filtering.
    subquery.where('action.item_path <@ :path').andWhere('action.view = :view').limit(size);
    if (types) {
      subquery.andWhere('action.type IN (:...types)');
    }

    // Second stage aggregation.
    const query = AppDataSource.createQueryBuilder()
      .from(`(${subquery.getQuery()})`, 'subquery')
      .setParameter('path', itemPath)
      .setParameter('view', view)
      .setParameter('types', types);

    if (aggregateFunction && aggregateMetric) {
      query.addSelect(
        buildAggregateExpression('subquery', aggregateFunction, aggregateMetric),
        'aggregateResult',
      );
    }
    aggregateBy?.forEach((attribute) => {
      const expression = `subquery."${attribute}"`;
      query.addSelect(expression).addGroupBy(expression);
    });
    return query.getRawMany();
  }
}
