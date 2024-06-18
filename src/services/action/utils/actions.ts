import geoip from 'geoip-lite';

import { AggregateFunction, AggregateMetric, Context } from '@graasp/sdk';

import { CLIENT_HOSTS } from '../../../utils/config.js';

export const getGeolocationIp = (ip: string | number): geoip.Lookup | null => geoip.lookup(ip);

export const getView = (headers: { origin?: string | string[] }): Context =>
  CLIENT_HOSTS.find(({ url }) => headers?.origin?.includes(url.hostname))?.name ?? Context.Unknown;

export const aggregateExpressionNames = {
  user: 'action.member_id',
  actionType: 'action.type',
  actionLocation: 'action.geolocation',
  itemId: 'action.item_id',
  createdDay: "date_trunc('day', action.createdAt)",
  createdTimeOfDay: 'extract(hour from action.created_at)',
  createdDayOfWeek: 'extract(dow from action.created_at)',
};

export const buildAggregateExpression = (
  subqueryName: string,
  func?: AggregateFunction,
  metric?: AggregateMetric,
): string => {
  return `${func}(${subqueryName}."${metric}")`;
};
