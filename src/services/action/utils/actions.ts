import { type Lookup, lookup } from 'geoip-lite';

import { AggregateFunction, AggregateMetric, type UnionOfConst } from '@graasp/sdk';

export const getGeolocationIp = (ip: string | number): Lookup | null => lookup(ip);

export const aggregateExpressionNames = {
  user: 'action.account_id',
  actionType: 'action.type',
  actionLocation: 'action.geolocation',
  itemId: 'action.item_id',
  createdDay: "date_trunc('day', action.createdAt)",
  createdTimeOfDay: 'extract(hour from action.created_at)',
  createdDayOfWeek: 'extract(dow from action.created_at)',
} as const;
export type AggregateExpressionValuesOptions = UnionOfConst<typeof aggregateExpressionNames>;

export const buildAggregateExpression = (
  subqueryName: string,
  func?: AggregateFunction,
  metric?: AggregateMetric,
): string => {
  return `${func}(${subqueryName}."${metric}")`;
};
