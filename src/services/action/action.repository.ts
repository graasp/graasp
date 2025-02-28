import { addMonths, formatISO } from 'date-fns';
import { and, between, count, desc, eq, inArray } from 'drizzle-orm/sql';

import {
  AggregateBy,
  AggregateFunction,
  AggregateMetric,
  UUID,
} from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { isDescendantOrSelf } from '../../drizzle/operations';
import {
  ActionInsertRaw,
  ActionWithItem,
  actionsTable,
  items,
} from '../../drizzle/schema';
import { MemberIdentifierNotFound } from '../itemLogin/errors';
import { DEFAULT_ACTIONS_SAMPLE_SIZE } from './constants';
import { CountGroupByOptions } from './types';
import {
  aggregateExpressionNames,
  buildAggregateExpression,
} from './utils/actions';
import { validateAggregationParameters } from './utils/utils';

export class ActionRepository {
  /**
   * Create given actions. Does not return them
   * @param action Action to create
   */
  async postMany(db: DBConnection, actions: ActionInsertRaw[]): Promise<void> {
    // FIX: this type, investigate why this does not typecheck and if we should use a different input type
    await db.insert(actionsTable).values(actions);
  }

  /**
   * Return all the actions generated by the given account.
   * @param accoundId ID of the account to retrieve the data.
   * @param filters.startDate date of actions after this date.
   * @param filters.endDate date of actions before this date.
   * @returns an array of filtered actions generated by the account, start and end dates.
   */
  async getAccountActions(
    db: DBConnection,
    accountId: string,
    filters: { startDate: Date; endDate: Date },
  ): Promise<ActionWithItem[]> {
    if (!accountId) {
      throw new MemberIdentifierNotFound();
    }

    const { startDate, endDate } = filters;

    const res = await db.query.actions.findMany({
      where: and(
        eq(actionsTable.accountId, accountId),
        between(
          actionsTable.createdAt,
          startDate.toISOString(),
          endDate.toISOString(),
        ),
      ),
      orderBy: desc(actionsTable.createdAt),
      with: {
        item: true,
      },
    });

    return res;
  }

  /**
   * Delete actions matching the given `accountId`. Return actions, or `null`, if delete has no effect.
   * @param accountId ID of the account whose actions are deleted
   */
  async deleteAllForAccount(
    db: DBConnection,
    accountId: string,
  ): Promise<void> {
    await db.delete(actionsTable).where(eq(actionsTable.accountId, accountId));
  }

  /**
   * Get random actions matching the given itemPath and below
   * @param itemPath path of the item whose actions are retrieved
   * @param filters.sampleSize number of actions to retrieve
   * @param filters.view get actions only for a given view
   */
  async getForItem(
    db: DBConnection,
    itemPath: UUID,
    filters?: {
      sampleSize?: number;
      view?: string;
      accountId?: UUID;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<ActionWithItem[]> {
    const size = filters?.sampleSize ?? DEFAULT_ACTIONS_SAMPLE_SIZE;
    const endDate = filters?.endDate ?? formatISO(new Date());
    const startDate = filters?.startDate ?? formatISO(addMonths(endDate, -1));

    const andConditions = [between(actionsTable.createdAt, startDate, endDate)];

    if (filters?.view) {
      andConditions.push(eq(actionsTable.view, filters.view));
    }

    if (filters?.accountId) {
      andConditions.push(eq(actionsTable.accountId, filters.accountId));
    }
    // subquery for items descendants of the itemPath queried
    const itemSub = await db
      .select()
      .from(items)
      .where(isDescendantOrSelf(items.path, itemPath))
      .as('item');
    const res = await db
      .select()
      .from(actionsTable)
      .innerJoin(itemSub, eq(actionsTable.itemId, itemSub.id))
      .where(and(...andConditions))
      .orderBy(desc(actionsTable.createdAt))
      .limit(size);

    // apply DTO
    const actions = res.map((r) => ({ ...r.action, item: r.item }));

    return actions;
    // return await db.query.actions.findMany({
    //   where: and(...andConditions),
    //   with: {
    //     item: { where: (items) => isDescendantOrSelf(items.path, itemPath) },
    //     account: true,
    //   },
    //   orderBy: desc(actionsTable.createdAt),
    //   limit: size,
    // });
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
    db: DBConnection,
    itemPath: UUID,
    filters?: {
      sampleSize?: number;
      view?: string;
      types?: string[];
      startDate?: string;
      endDate?: string;
    },
    countGroupBy: CountGroupByOptions[] = [],
    aggregationParams?: {
      aggregateFunction: AggregateFunction;
      aggregateMetric: AggregateMetric;
      aggregateBy?: AggregateBy[];
    },
  ) {
    // verify parameters
    validateAggregationParameters({ countGroupBy, aggregationParams });

    const {
      aggregateFunction,
      aggregateMetric,
      aggregateBy = [],
    } = aggregationParams ?? {};

    const size = filters?.sampleSize ?? DEFAULT_ACTIONS_SAMPLE_SIZE;
    const view = filters?.view ?? 'Unknown';
    const types = filters?.types;
    const endDate = filters?.endDate ?? formatISO(new Date());
    const startDate = filters?.startDate ?? formatISO(addMonths(endDate, -1));

    const countGroupByColumns = Object.fromEntries(
      countGroupBy.map((attribute) => {
        const columnName = aggregateExpressionNames[attribute];
        return [columnName, attribute];

        // addGroupBy(columnName);
      }),
    );

    // Get the actionCount from the first stage aggregation.
    const andConditions = [
      eq(actionsTable.view, view),
      between(actionsTable.createdAt, startDate, endDate),
    ];
    if (types) {
      andConditions.push(inArray(actionsTable.type, types));
    }

    const subquery = db
      .select({
        actionCount: count(),
        ...countGroupByColumns,
      })
      .from(actionsTable)
      .where(and(...andConditions))
      .innerJoin(
        items,
        and(
          eq(actionsTable.itemId, items.id),
          isDescendantOrSelf(items.path, itemPath),
        ),
      )
      .groupBy(Object.keys(countGroupByColumns))
      .limit(size)
      .as('subquery');

    // Second stage aggregation.
    const select: any = [];

    if (aggregateFunction && aggregateMetric) {
      select.push({
        aggregateResult: buildAggregateExpression(
          'subquery',
          aggregateFunction,
          aggregateMetric,
        ),
      });
    }
    const groupByParams: string[] = [];
    const aggregateByParams = aggregateBy.map((attribute) => {
      const expression = `subquery."${attribute}"`;
      // query.addSelect(expression).addGroupBy(expression);
      select[attribute] = expression;
      groupByParams.push(expression);
    });

    const query = await db.select(select).from(subquery).groupBy(groupByParams);

    return query;
  }
}
