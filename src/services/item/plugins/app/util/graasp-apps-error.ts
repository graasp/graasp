import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';
import { FAILURE_MESSAGES } from '@graasp/translations';

import { PLUGIN_NAME } from './constants';

export const GraaspAppsError = ErrorFactory(PLUGIN_NAME);

export class NotAppItem extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR001',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.NOT_APP_ITEM,
      },
      data,
    );
  }
}

export class InvalidApplicationOrigin extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR002',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.INVALID_APP_ORIGIN,
      },
      data,
    );
  }
}

export class TokenItemIdMismatch extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR003',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.TOKEN_ITEM_ID_MISMATCH,
      },
      data,
    );
  }
}

export class AppDataNotFound extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR004',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.APP_DATA_NOT_FOUND,
      },
      data,
    );
  }
}

export class AppDataNotAccessible extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR005',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.APP_DATA_NOT_ACCESSIBLE,
      },
      data,
    );
  }
}

export class AppActionNotAccessible extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR006',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.APP_ACTION_NOT_ACCESSIBLE,
      },
      data,
    );
  }
}

export class AppSettingNotFound extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR007',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.APP_SETTING_NOT_FOUND,
      },
      data,
    );
  }
}

export class PreventUpdateAppDataFile extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR008',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.PREVENT_APP_DATA_FILE_UPDATE,
      },
      data,
    );
  }
}

export class PreventUpdateAppSettingFile extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR009',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.PREVENT_APP_SETTING_FILE_UPDATE,
      },
      data,
    );
  }
}

export class FileServiceNotDefined extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GAERR010',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: FAILURE_MESSAGES.FILE_SERVICE_NOT_DEFINED,
      },
      data,
    );
  }
}

// TODO: these errors can be removed if we reuse the core tasks
export class MemberCannotReadItem extends GraaspAppsError {
  constructor(data?: unknown) {
    super(
      { code: 'GAERR011', statusCode: StatusCodes.FORBIDDEN, message: 'Member cannot read item' },
      data,
    );
  }
}

export class ItemNotFound extends GraaspAppsError {
  constructor(data?: unknown) {
    super({ code: 'GAERR012', statusCode: StatusCodes.NOT_FOUND, message: 'Item not found' }, data);
  }
}
