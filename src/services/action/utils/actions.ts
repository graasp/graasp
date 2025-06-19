import { type Lookup, lookup } from 'geoip-lite';

export const getGeolocationIp = (ip: string | number): Lookup | null => lookup(ip);
