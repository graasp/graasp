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
export type AggregateFunctionType = 'AVG' | 'COUNT' | 'SUM';

export const convertToExpressionName = (attribute: AggregateAttribute): string => {
  switch (attribute) {
    case 'user':
      return 'action.member_id';
    case 'actionType':
      return 'action.type';
    case 'actionLocation':
      return 'action.geolocation';
    case 'itemId':
      return 'action.item_path';
    case 'createdDay':
      return "date_trunc('day', action.createdAt)";
    case 'createdTimeOfDay':
      return 'extract(hour from created_at)';
    case 'createdDayOfWeek':
      return 'extract(dow from created_at)';
    default:
      throw new Error(`${attribute} Attribute does not exist.`);
  }
};

export const buildAggregateExpression = (
  subqueryName: string,
  func?: AggregateFunctionType,
  metric?: AggregateAttribute,
): string => {
  return func + '(' + subqueryName + '."' + metric + '")';
};
