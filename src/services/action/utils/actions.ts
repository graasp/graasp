import geoip from 'geoip-lite';

import { Context, Hostname } from '@graasp/sdk';

export const getGeolocationIp = (ip: string | number): geoip.Lookup => geoip.lookup(ip);

export const getView = (
  headers: { origin?: string | string[] },
  hosts: Hostname[],
): Context | 'Unknown' =>
  hosts.find(({ hostname: thisHN }) => headers?.origin?.includes(thisHN))?.name ?? 'Unknown';
