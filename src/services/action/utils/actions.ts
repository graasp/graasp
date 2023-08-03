import geoip from 'geoip-lite';

import { Context } from '@graasp/sdk';

import { CLIENT_HOSTS } from '../../../utils/config';

export const getGeolocationIp = (ip: string | number): geoip.Lookup | null => geoip.lookup(ip);

export const getView = (headers: { origin?: string | string[] }): Context =>
  CLIENT_HOSTS.find(({ url }) => headers?.origin?.includes(url.hostname))?.name ?? Context.Unknown;
