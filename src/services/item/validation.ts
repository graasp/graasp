import { Ajv } from 'ajv';

import { ItemGeolocation } from '@graasp/sdk';

import { Item } from './entities/Item';
import { geoCoordinateSchema } from './plugins/geolocation/schemas';
import { settingsSchema } from './schemas';

/**
 * Declare compiled validators to be used in manual validation
 */
const ajv = new Ajv({ allErrors: true });
export const validateSettings = ajv.compile<Item['settings']>(settingsSchema);
export const validateGeolocation =
  ajv.compile<Pick<ItemGeolocation, 'lat' | 'lng'>>(geoCoordinateSchema);
