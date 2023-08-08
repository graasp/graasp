import { AggregateBy, AggregateFunction, AggregateMetric, CountGroupBy } from '@graasp/sdk';

import { InvalidAggregationError } from '../../../action/utils/errors';

export const PLUGIN_NAME = 'graasp-plugin-item-actions';

export enum ItemActionType {
  Update = 'update',
  Create = 'create',
  Delete = 'delete',
  Copy = 'copy',
  Move = 'move',
}
export const validateAggregateRequest = (
  countGroupBy: CountGroupBy[],
  aggregateFuction: AggregateFunction,
  aggregateMetric: AggregateMetric,
  aggregateBy?: AggregateBy[],
) => {
  // Aggregate by user is not allowed
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (aggregateBy?.includes('user')) {
    throw new InvalidAggregationError('aggregate by cannot be "user"');
  }

  // Perform aggregation on a grouping expression is not allowed
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (aggregateBy?.includes(aggregateMetric)) {
    throw new InvalidAggregationError('aggregateBy cannot include aggregateMetric');
  }

  // The input of the second stage aggregation should be the output of the first stage aggregation
  if (
    !(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      (countGroupBy.includes(aggregateMetric) || aggregateMetric === 'actionCount')
    )
  ) {
    throw new InvalidAggregationError(
      'countGroupBy cannot include aggregateMetric or aggregateMetric cannot be actionCount',
    );
  }

  aggregateBy?.forEach((element) => {
    if (
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      !(countGroupBy.includes(element) || element === 'actionCount')
    ) {
      throw new InvalidAggregationError(
        'countGroupBy should include aggregateBy, unless it is actionCount',
      );
    }
  });

  // avg and sum functions can only be applied on numeric expressions
  if (
    [AggregateFunction.Avg, AggregateFunction.Sum].includes(aggregateFuction) &&
    aggregateMetric !== 'actionCount'
  ) {
    throw new InvalidAggregationError(
      'aggregateFuction cannot be applied on aggregateMetric=actionCount',
    );
  }

  return;
};

// Constants to check the validity of the query parameters when obtaining actions
export const DEFAULT_ACTIONS_SAMPLE_SIZE = 5000;
export const MIN_ACTIONS_SAMPLE_SIZE = 0;
export const MAX_ACTIONS_SAMPLE_SIZE = 10000;

export const ZIP_MIMETYPE = 'application/zip';

export const DEFAULT_REQUEST_EXPORT_INTERVAL = 3600 * 1000 * 24; // 1 day - used for timestamp
export const EXPORT_FILE_EXPIRATION_DAYS = 7;
export const EXPORT_FILE_EXPIRATION = 3600 * 24 * EXPORT_FILE_EXPIRATION_DAYS; // max value: one week
