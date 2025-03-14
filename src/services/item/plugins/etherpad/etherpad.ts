import { default as EtherpadApi } from '@graasp/etherpad-api';

import { wrapErrorsWithCustom } from '../../../../utils/errorsWrapper.js';
import { EtherpadServerError } from './errors.js';

/**
 * A wrapper for Etherpad which converts errors into graasp error.
 */
export const wrapEtherpadErrors = (etherpad: EtherpadApi) =>
  wrapErrorsWithCustom(etherpad, EtherpadServerError);
