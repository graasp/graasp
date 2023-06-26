import geoip from 'geoip-lite';

import { Context, Hostname } from '@graasp/sdk';

export const getGeolocationIp = (ip: string | number): geoip.Lookup | null => geoip.lookup(ip);

export const getView = (headers: { origin?: string | string[] }, hosts: Hostname[]): Context =>
  hosts.find(({ hostname: thisHN }) => headers?.origin?.includes(thisHN))?.name ?? Context.Unknown;

export type AggregateAttribute =
  | 'user'
  | 'createdDay'
  | 'createdTimeOfDay'
  | 'createdDayOfWeek'
  | 'actionType'
  | 'actionLocation'
  | 'itemId'
  | 'actionCount';
export type AggregateFunctionType = 'avg' | 'count' | 'sum';

export const aggregateExpressionNames = {
  user: 'action.member_id',
  actionType: 'action.type',
  actionLocation: 'action.geolocation',
  itemId: 'action.item_path',
  createdDay: "date_trunc('day', action.createdAt)",
  createdTimeOfDay: 'extract(hour from created_at)',
  createdDayOfWeek: 'extract(dow from created_at)',
};

export const buildAggregateExpression = (
  subqueryName: string,
  func?: AggregateFunctionType,
  metric?: AggregateAttribute,
): string => {
  return `${func}(${subqueryName}."${metric}")`;
};
