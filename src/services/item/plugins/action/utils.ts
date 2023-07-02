import { AggregateAttribute, AggregateFunctionType } from '../../../action/utils/actions';
import { InvalidAggregationError } from '../../../action/utils/errors';

export const PLUGIN_NAME = 'graasp-plugin-item-actions';

export const VIEW_UNKNOWN_NAME = 'unknown';

export enum ItemActionType {
  Update = 'update',
  Create = 'create',
  Delete = 'delete',
  Copy = 'copy',
  Move = 'move',
}

export const validateAggregateRequest = (
  countGroupBy: AggregateAttribute[],
  aggregateFuction: AggregateFunctionType,
  aggregateMetric: AggregateAttribute,
  aggregateBy: AggregateAttribute[],
) => {
  // Aggregate by user is not allowed
  if (aggregateBy?.includes('user')) {
    throw new InvalidAggregationError();
  }

  // Perform aggregation on a grouping expression is not allowed
  if (aggregateBy?.includes(aggregateMetric)) {
    throw new InvalidAggregationError();
  }

  // The input of the second stage aggregation should be the output of the first stage aggregation
  if (!(countGroupBy.includes(aggregateMetric) || aggregateMetric === 'actionCount')) {
    throw new InvalidAggregationError();
  }

  aggregateBy?.forEach((element) => {
    if (!(countGroupBy.includes(element) || element === 'actionCount')) {
      throw new InvalidAggregationError();
    }
  });

  // avg and sum functions can only be applied on numeric expressions
  if (['avg', 'sum'].includes(aggregateFuction) && aggregateMetric !== 'actionCount') {
    throw new InvalidAggregationError();
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
