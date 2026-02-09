import { Ajv } from 'ajv';

import type { ItemGeolocation } from '@graasp/sdk';

import { type ItemRaw } from '../../drizzle/item.dto';
import { geoCoordinateSchema } from './plugins/geolocation/itemGeolocation.schemas';
import { settingsSchema } from './schemas';

/**
 * Declare compiled validators to be used in manual validation
 */
const ajv = new Ajv({ allErrors: true });
export const validateSettings = ajv.compile<ItemRaw['settings']>(settingsSchema);
export const validateGeolocation =
  ajv.compile<Pick<ItemGeolocation, 'lat' | 'lng'>>(geoCoordinateSchema);
