import { Between, EntityManager, In, Repository } from 'typeorm';

import { AggregateBy, AggregateFunction, AggregateMetric, CountGroupBy, UUID } from '@graasp/sdk';

import { AppDataSource } from '../../../plugins/datasource';
import { MemberIdentifierNotFound } from '../../itemLogin/errors';
import { actionSchema } from '../../member/plugins/export-data/schemas/schemas';
import { schemaToSelectMapper } from '../../member/plugins/export-data/utils/selection.utils';
import { DEFAULT_ACTIONS_SAMPLE_SIZE } from '../constants/constants';
import { Action } from '../entities/action';
import { aggregateExpressionNames, buildAggregateExpression } from '../utils/actions';
import { validateAggregationParameters } from '../utils/utils';

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
   * Return all the actions generated by the given member.
   * @param memberId ID of the member to retrieve the data.
   * @returns an array of actions generated by the member.
   */
  async getForMemberExport(memberId: string): Promise<Action[]> {
    if (!memberId) {
      throw new MemberIdentifierNotFound();
    }

    return this.repository.find({
      select: schemaToSelectMapper(actionSchema),
      where: { member: { id: memberId } },
      order: { createdAt: 'DESC' },
      relations: {
        item: true,
      },
    });
  }

  /**
   * Return all the actions generated by the given member.
   * @param memberId ID of the member to retrieve the data.
   * @param filters.startDate date of actions after this date.
   * @param filters.endDate date of actions before this date.
   * @param filters.allowedTypes types of actions to get.
   * @returns an array of filtered actions generated by the member based on allowed types, start and end dates.
   */
  async getForMember(
    memberId: string,
    filters: { startDate: Date; endDate: Date },
  ): Promise<Action[]> {
    if (!memberId) {
      throw new MemberIdentifierNotFound();
    }

    const { startDate, endDate } = filters;

    return this.repository.find({
      // select: schemaToSelectMapper(actionSchema),
      where: {
        member: { id: memberId },
        item: {},
        createdAt: Between(startDate, endDate),
      },
      order: { createdAt: 'DESC' },
      relations: {
        item: true,
      },
    });
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
    aggregationParams?: {
      aggregateFunction: AggregateFunction;
      aggregateMetric: AggregateMetric;
      aggregateBy?: AggregateBy[];
    },
  ): Promise<unknown[]> {
    // verify parameters
    validateAggregationParameters({ countGroupBy, aggregationParams });

    const { aggregateFunction, aggregateMetric, aggregateBy } = aggregationParams ?? {};

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
    subquery
      .innerJoin('action.item', 'item')
      .where('item.path <@ :path')
      .andWhere('action.view = :view')
      .limit(size);

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
