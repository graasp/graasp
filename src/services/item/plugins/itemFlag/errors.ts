import { ErrorFactory } from '@graasp/sdk';

import { PLUGIN_NAME } from './constants.js';

export const GraaspItemFlagsError = ErrorFactory(PLUGIN_NAME);
export class FlagNotFound extends GraaspItemFlagsError {
  constructor(data?: unknown) {
    super({ code: 'GIFERR003', statusCode: 404, message: 'Flag not found' }, data);
  }
}
