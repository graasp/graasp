import Ajv from 'ajv';

import { ItemGeolocation } from '@graasp/sdk';

import { Item } from './entities/Item.js';
import { geolocation, settings } from './fluent-schema.js';

/**
 * Decalre compiled validators to be used in manual validation
 */
const ajv = new Ajv({ allErrors: true });
export const validateSettings = ajv.compile<Item['settings']>(settings.valueOf());
// const validateExtra = ajv.compile(extra.valueOf());
export const validateGeolocation = ajv.compile<Pick<ItemGeolocation, 'lat' | 'lng'>>(
  geolocation.valueOf(),
);
