import { AggregateBy, AggregateFunction, AggregateMetric, CountGroupBy } from '@graasp/sdk';

import {
  AggregateByCannotIncludeAggregateMetricError,
  AggregateByCannotUserError,
  CountGroupByShouldIncludeAggregateByError,
  CountGroupByShouldIncludeAggregateMetricError,
  InvalidAggregateFunctionError,
} from './errors.js';

export const validateAggregationParameters = ({
  countGroupBy,
  aggregationParams,
}: {
  countGroupBy?: CountGroupBy[];
  aggregationParams?: {
    aggregateFunction?: AggregateFunction;
    aggregateMetric?: AggregateMetric;
    aggregateBy?: AggregateBy[];
  };
}) => {
  const { aggregateFunction, aggregateMetric, aggregateBy } = aggregationParams ?? {};

  // Aggregate by user is not allowed
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore: additional check on aggregateBy. Is it necessary?
  if (aggregateBy?.includes('user')) {
    throw new AggregateByCannotUserError({ aggregateBy });
  }

  // Perform aggregation on a grouping expression is not allowed
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (aggregateBy?.includes(aggregateMetric)) {
    throw new AggregateByCannotIncludeAggregateMetricError({ aggregateBy, aggregateMetric });
  }

  // countGroupBy should include aggregateMetric, except for aggregateMetric !== 'actionCount'
  // countGroupBy can be defined alone, but aggregate metric needs countGroupBy to exist
  // or countGroupBy can be undefined but aggregateMetric has to be actionCount
  if (
    ((!countGroupBy && aggregateMetric) ||
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      (countGroupBy && aggregateMetric && !countGroupBy.includes(aggregateMetric))) &&
    aggregateMetric !== AggregateMetric.ActionCount
  ) {
    throw new CountGroupByShouldIncludeAggregateMetricError({ countGroupBy, aggregateMetric });
  }

  aggregateBy?.forEach((element) => {
    if (
      countGroupBy &&
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      !countGroupBy.includes(element) &&
      element !== 'actionCount'
    ) {
      throw new CountGroupByShouldIncludeAggregateByError({ countGroupBy, aggregateBy: element });
    }
  });

  // avg and sum functions can only be applied on numeric expressions
  if (
    aggregateFunction &&
    [AggregateFunction.Avg, AggregateFunction.Sum].includes(aggregateFunction) &&
    aggregateMetric !== 'actionCount'
  ) {
    throw new InvalidAggregateFunctionError({ aggregateMetric, aggregateFunction });
  }

  return;
};
