import { StatusCodes } from 'http-status-codes';

import { ErrorFactory } from '@graasp/sdk';

const PLUGIN_NAME = 'graasp-plugin-item-login';

export const GraaspItemLoginError = ErrorFactory(PLUGIN_NAME);

export class MemberIdentifierNotFound extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR002',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'Member identifier not found',
      },
      data,
    );
  }
}

export class InvalidMember extends GraaspItemLoginError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GILERR003',
        statusCode: StatusCodes.NOT_FOUND,
        message: 'This member cannot be used to login to an item',
      },
      data,
    );
  }
}

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
        message: 'Item does not possess the required tag',
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
