import { AggregateBy, AggregateFunction, AggregateMetric, CountGroupBy } from '@graasp/sdk';

import {
  AggregateByCannotIncludeAggregateMetricError,
  AggregateByCannotUserError,
  CountGroupByShouldIncludeAggregateByError,
  CountGroupByShouldIncludeAggregateMetricError,
  InvalidAggregateFunctionError,
} from './errors.js';
import { validateAggregationParameters } from './utils.js';

describe('validateAggregationParameters', () => {
  it('AggregateByCannotUserError', () => {
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.ActionLocation],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.CreatedDay,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          aggregateBy: ['user'],
        },
      }),
    ).toThrow(AggregateByCannotUserError);
  });
  it('AggregateByCannotIncludeAggregateMetricError', () => {
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.ActionLocation],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.CreatedDay,
          aggregateBy: [AggregateBy.CreatedDay],
        },
      }),
    ).toThrow(AggregateByCannotIncludeAggregateMetricError);
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.ActionLocation],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.ActionCount,
          aggregateBy: [AggregateBy.ActionCount],
        },
      }),
    ).toThrow(AggregateByCannotIncludeAggregateMetricError);
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.ActionLocation],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.ActionLocation,
          aggregateBy: [AggregateBy.ActionLocation],
        },
      }),
    ).toThrow(AggregateByCannotIncludeAggregateMetricError);
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.CreatedDay, CountGroupBy.ActionType],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Sum,
          aggregateMetric: AggregateMetric.ActionCount,
          aggregateBy: [AggregateBy.ActionCount],
        },
      }),
    ).toThrow(AggregateByCannotIncludeAggregateMetricError);
  });
  it('CountGroupByShouldIncludeAggregateMetricError', () => {
    expect(() =>
      validateAggregationParameters({
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.CreatedDay,
        },
      }),
    ).toThrow(CountGroupByShouldIncludeAggregateMetricError);
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.ActionLocation],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.CreatedDay,
        },
      }),
    ).toThrow(CountGroupByShouldIncludeAggregateMetricError);
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.CreatedDayOfWeek],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.CreatedDay,
        },
      }),
    ).toThrow(CountGroupByShouldIncludeAggregateMetricError);
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.ItemId],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.CreatedDay,
        },
      }),
    ).toThrow(CountGroupByShouldIncludeAggregateMetricError);
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.ItemId],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.ActionType,
        },
      }),
    ).toThrow(CountGroupByShouldIncludeAggregateMetricError);
    expect(() =>
      validateAggregationParameters({
        aggregationParams: { aggregateMetric: AggregateMetric.ActionLocation },
      }),
    ).toThrow(CountGroupByShouldIncludeAggregateMetricError);
  });
  it('InvalidAggregateFunctionError', () => {
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.CreatedDay],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.CreatedDay,
        },
      }),
    ).toThrow(InvalidAggregateFunctionError);
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.ActionLocation],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.ActionLocation,
        },
      }),
    ).toThrow(InvalidAggregateFunctionError);
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.ActionLocation],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Sum,
          aggregateMetric: AggregateMetric.ActionLocation,
        },
      }),
    ).toThrow(InvalidAggregateFunctionError);
    expect(() =>
      validateAggregationParameters({
        aggregationParams: { aggregateFunction: AggregateFunction.Avg },
      }),
    ).toThrow(InvalidAggregateFunctionError);
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.ActionType],
        aggregationParams: { aggregateMetric: AggregateMetric.CreatedDay },
      }),
    ).toThrow(CountGroupByShouldIncludeAggregateMetricError);
  });
  it('CountGroupByShouldIncludeAggregateByError', () => {
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.CreatedDay, CountGroupBy.ActionType],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Sum,
          aggregateMetric: AggregateMetric.ActionCount,
          aggregateBy: [AggregateBy.ActionLocation],
        },
      }),
    ).toThrow(CountGroupByShouldIncludeAggregateByError);
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.CreatedDay, CountGroupBy.ActionType],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Sum,
          aggregateMetric: AggregateMetric.ActionCount,
          aggregateBy: [AggregateBy.CreatedDayOfWeek],
        },
      }),
    ).toThrow(CountGroupByShouldIncludeAggregateByError);
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.CreatedDay],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.ActionCount,
          aggregateBy: [AggregateBy.CreatedDayOfWeek],
        },
      }),
    ).toThrow(CountGroupByShouldIncludeAggregateByError);
  });
  it('does not throw', () => {
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.ActionLocation],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Count,
          aggregateMetric: AggregateMetric.ActionLocation,
        },
      }),
    ).not.toThrow();
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.CreatedDayOfWeek],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.ActionCount,
        },
      }),
    ).not.toThrow();
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.CreatedDay],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.ActionCount,
        },
      }),
    ).not.toThrow();
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.CreatedDay],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Count,
          aggregateMetric: AggregateMetric.ActionCount,
        },
      }),
    ).not.toThrow();
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.CreatedDay, CountGroupBy.ActionType],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Sum,
          aggregateMetric: AggregateMetric.ActionCount,
        },
      }),
    ).not.toThrow();
    expect(() =>
      validateAggregationParameters({
        countGroupBy: [CountGroupBy.CreatedDay, CountGroupBy.ActionType],
        aggregationParams: {
          aggregateFunction: AggregateFunction.Sum,
          aggregateMetric: AggregateMetric.ActionCount,
          aggregateBy: [AggregateBy.CreatedDay],
        },
      }),
    ).not.toThrow();
  });
  it('missing parameters should return', () => {
    expect(() => validateAggregationParameters({})).not.toThrow();
    expect(() =>
      validateAggregationParameters({ countGroupBy: [CountGroupBy.ActionLocation] }),
    ).not.toThrow();
    expect(() =>
      validateAggregationParameters({
        aggregationParams: {
          aggregateFunction: AggregateFunction.Avg,
          aggregateMetric: AggregateMetric.ActionCount,
        },
      }),
    ).not.toThrow();
    expect(() =>
      validateAggregationParameters({
        aggregationParams: { aggregateFunction: AggregateFunction.Count },
      }),
    ).not.toThrow();
    expect(() =>
      validateAggregationParameters({
        aggregationParams: { aggregateMetric: AggregateMetric.ActionCount },
      }),
    ).not.toThrow();
    expect(() => validateAggregationParameters({ countGroupBy: [] })).not.toThrow();
  });
});
