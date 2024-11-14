import { StatusCodes } from 'http-status-codes';

import { ErrorFactory, UUID } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

const PLUGIN_NAME = 'graasp-plugin-tags';

/**
 * Errors thrown by the tag plugins
 */

export const GraaspTagsError = ErrorFactory(PLUGIN_NAME);

export class ItemTagAlreadyExists extends GraaspTagsError {
  constructor(data?: { itemId: UUID; tagId: UUID }) {
    super(
      {
        code: 'GITERR001',
        statusCode: StatusCodes.CONFLICT,
        message: FAILURE_MESSAGES.ITEM_TAG_ALREADY_EXISTS,
      },
      data,
    );
  }
}
