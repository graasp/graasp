import { FastifyError } from 'fastify';
import { FAILURE_MESSAGES } from '@graasp/translations';
import { StatusCodes } from 'http-status-codes';

type ErrorOrigin = 'core' | 'plugin' | 'unknown' | string;

export interface GraaspError extends FastifyError {
  data?: unknown;
  origin: ErrorOrigin;
}

export interface GraaspErrorDetails {
  code: string;
  message: string;
  statusCode: number;
}

export abstract class BaseGraaspError implements GraaspError {
  name: string;
  code: string;
  statusCode?: number;
  message: string;
  data?: unknown;
  origin: ErrorOrigin;

  constructor({ code, statusCode, message }: GraaspErrorDetails, data?: unknown) {
    this.name = code;
    this.code = code;
    this.message = message;
    this.statusCode = statusCode;
    this.origin = 'core';
    this.data = data;
  }
}

export class ItemNotFound extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR001',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.ITEM_NOT_FOUND,
      },
      data,
    );
  }
}
export class MemberCannotReadItem extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR002',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.USER_CANNOT_READ_ITEM,
      },
      data,
    );
  }
}
export class MemberCannotWriteItem extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR003',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.USER_CANNOT_WRITE_ITEM,
      },
      data,
    );
  }
}
export class MemberCannotAdminItem extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR004',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.USER_CANNOT_ADMIN_ITEM,
      },
      data,
    );
  }
}
export class InvalidMembership extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR005',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_MEMBERSHIP,
      },
      data,
    );
  }
}
export class ItemMembershipNotFound extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR006',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.ITEM_MEMBERSHIP_NOT_FOUND,
      },
      data,
    );
  }
}
export class ModifyExisting extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR007',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.MODIFY_EXISTING,
      },
      data,
    );
  }
}
export class InvalidPermissionLevel extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR008',
        statusCode: StatusCodes.BAD_REQUEST,
        message: FAILURE_MESSAGES.INVALID_PERMISSION_LEVEL,
      },
      data,
    );
  }
}
export class HierarchyTooDeep extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR009',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.HIERARCHY_TOO_DEEP,
      },
      data,
    );
  }
}
export class TooManyChildren extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR010',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.TOO_MANY_CHILDREN,
      },
      data,
    );
  }
}
export class TooManyDescendants extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR011',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.TOO_MANY_DESCENDANTS,
      },
      data,
    );
  }
}
export class InvalidMoveTarget extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      { code: 'GERR012', statusCode: 400, message: FAILURE_MESSAGES.INVALID_MOVE_TARGET },
      data,
    );
  }
}
export class MemberNotFound extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR013', statusCode: 404, message: FAILURE_MESSAGES.MEMBER_NOT_FOUND }, data);
  }
}
export class CannotModifyOtherMembers extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR014',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.CANNOT_MODIFY_OTHER_MEMBERS,
      },
      data,
    );
  }
}
export class TooManyMemberships extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR015',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.TOO_MANY_MEMBERSHIP,
      },
      data,
    );
  }
}
export class MemberCannotAccess extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR016',
        statusCode: StatusCodes.FORBIDDEN,
        message: FAILURE_MESSAGES.MEMBER_CANNOT_ACCESS,
      },
      data,
    );
  }
}

export class MemberAlreadySignedUp extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR017',
        statusCode: StatusCodes.CONFLICT,
        message: FAILURE_MESSAGES.MEMBER_ALREADY_SIGNED_UP,
      },
      data,
    );
  }
}

export class MemberNotSignedUp extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR018',
        statusCode: StatusCodes.NOT_FOUND,
        message: FAILURE_MESSAGES.MEMBER_NOT_SIGNED_UP,
      },
      data,
    );
  }
}

export class MemberWithoutPassword extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR019',
        statusCode: StatusCodes.NOT_ACCEPTABLE,
        message: FAILURE_MESSAGES.MEMBER_WITHOUT_PASSWORD,
      },
      data,
    );
  }
}

export class IncorrectPassword extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR020',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.INCORRECT_PASSWORD,
      },
      data,
    );
  }
}

export class TokenExpired extends BaseGraaspError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super({ code: 'GERR021', statusCode: 439, message: FAILURE_MESSAGES.TOKEN_EXPIRED }, data);
  }
}

export class InvalidToken extends BaseGraaspError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super(
      {
        code: 'GERR022',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.INVALID_TOKEN,
      },
      data,
    );
  }
}

export class InvalidSession extends BaseGraaspError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super(
      {
        code: 'GERR023',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.INVALID_SESSION,
      },
      data,
    );
  }
}

export class OrphanSession extends BaseGraaspError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super(
      {
        code: 'GERR024',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.ORPHAN_SESSION,
      },
      data,
    );
  }
}

export class InvalidPassword extends BaseGraaspError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super(
      {
        code: 'GERR025',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.INVALID_PASSWORD,
      },
      data,
    );
  }
}

export class EmptyCurrentPassword extends BaseGraaspError {
  constructor(data?: unknown) {
    // this status code is custom for the browser to know it needs to refresh its token
    super(
      {
        code: 'GERR026',
        statusCode: StatusCodes.UNAUTHORIZED,
        message: FAILURE_MESSAGES.EMPTY_CURRENT_PASSWORD,
      },
      data,
    );
  }
}

export class DatabaseError extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR998', statusCode: 500, message: FAILURE_MESSAGES.DATABASE_ERROR }, data);
  }
}

export class UnexpectedError extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR999', statusCode: 500, message: FAILURE_MESSAGES.UNEXPECTED_ERROR }, data);
    this.origin = 'unknown';
  }
}
