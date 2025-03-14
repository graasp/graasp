import { Ajv } from 'ajv';

import { ItemGeolocation } from '@graasp/sdk';

import { Item } from '../../drizzle/types.js';
import { geoCoordinateSchema } from './plugins/geolocation/schemas.js';
import { settingsSchema } from './schemas.js';

/**
 * Declare compiled validators to be used in manual validation
 */
const ajv = new Ajv({ allErrors: true });
export const validateSettings = ajv.compile<Item['settings']>(settingsSchema);
export const validateGeolocation =
  ajv.compile<Pick<ItemGeolocation, 'lat' | 'lng'>>(geoCoordinateSchema);
