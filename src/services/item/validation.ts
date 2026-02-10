import { Ajv } from 'ajv';

import type { ItemGeolocation } from '@graasp/sdk';

import { settingsSchema } from './common.schemas';
import { type ItemRaw } from './item';
import { geoCoordinateSchema } from './plugins/geolocation/itemGeolocation.schemas';

/**
 * Declare compiled validators to be used in manual validation
 */
const ajv = new Ajv({ allErrors: true });
export const validateSettings = ajv.compile<ItemRaw['settings']>(settingsSchema);
export const validateGeolocation =
  ajv.compile<Pick<ItemGeolocation, 'lat' | 'lng'>>(geoCoordinateSchema);
