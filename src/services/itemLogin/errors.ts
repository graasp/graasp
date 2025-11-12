import { StatusCodes } from 'http-status-codes';

import { createError } from '@fastify/error';

import { ErrorFactory, FAILURE_MESSAGES } from '@graasp/sdk';

const PLUGIN_NAME = 'graasp-plugin-item-login';

export const GraaspItemLoginError = ErrorFactory(PLUGIN_NAME);

export const MemberIdentifierNotFound = createError(
  'GILERR002',
  'Member identifier not found',
  StatusCodes.NOT_FOUND,
);

export const InvalidMember = createError(
  'GILERR003',
  'This member cannot be used to login to an item',
  StatusCodes.NOT_FOUND,
);

export class MissingItemLoginSchema extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR004',
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        message: 'Missing login schema',
      },
      data,
    );
  }
}

export class MissingItemLoginTag extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR005',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Item does not possess the required visibility',
      },
      data,
    );
  }
}

export class ValidMemberSession extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR006',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Member with valid session trying to (re)login',
      },
      data,
    );
  }
}

export class InvalidCredentials extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR007',
        statusCode: StatusCodes.UNAUTHORIZED,
        // eslint-disable-next-line quotes
        message: "Provided credentials don't match member's",
      },
      data,
    );
  }
}

export class MissingCredentialsForLoginSchema extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR008',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Missing credentials for set login schema',
      },
      data,
    );
  }
}

export class UnnecessaryCredentialsForLoginSchema extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR008',
        statusCode: StatusCodes.BAD_REQUEST,
        message: 'Unnecessary credentials for set login schema',
      },
      data,
    );
  }
}

export class ItemLoginSchemaNotFound extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR009',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Item login schema not found for item',
      },
      data,
    );
  }
}

export class CannotNestItemLoginSchema extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR010',
        statusCode: StatusCodes.FORBIDDEN,
        message: 'Item login schema already item exists in an ancestor',
      },
      data,
    );
  }
}

export class NotGuest extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR011',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.NOT_A_GUEST,
      },
      data,
    );
  }
}

export class ItemLoginSchemaExists extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR012',
        statusCode: StatusCodes.CONFLICT,
        message: FAILURE_MESSAGES.CANNOT_CREATE_MEMBERSHIP_CAUSE_ITEM_LOGIN_SCHEMA_EXISTS,
      },
      data,
    );
  }
}

export class CannotEnrollItemWithoutItemLoginSchema extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR013',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.CANNOT_ENROLL_ITEM_WITHOUT_ITEM_LOGIN_SCHEMA,
      },
      data,
    );
  }
}

export class CannotRegisterOnFrozenItemLoginSchema extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR014',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.CANNOT_REGISTER_ON_FROZEN_ITEM_LOGIN_SCHEMA,
      },
      data,
    );
  }
}

export class CannotEnrollFrozenItemLoginSchema extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR015',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.CANNOT_ENROLL_FROZEN_ITEM_LOGIN_SCHEMA,
      },
      data,
    );
  }
}

export class GuestNotFound extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR016',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'GUEST_NOT_FOUND',
      },
      data,
    );
  }
}
