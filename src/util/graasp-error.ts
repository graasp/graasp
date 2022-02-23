import { FastifyError } from 'fastify';
import { FAILURE_MESSAGES } from '@graasp/translations';

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
    super({ code: 'GERR001', statusCode: 404, message: FAILURE_MESSAGES.ITEM_NOT_FOUND }, data);
  }
}
export class MemberCannotReadItem extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      { code: 'GERR002', statusCode: 403, message: FAILURE_MESSAGES.USER_CANNOT_READ_ITEM },
      data,
    );
  }
}
export class MemberCannotWriteItem extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      { code: 'GERR003', statusCode: 403, message: FAILURE_MESSAGES.USER_CANNOT_WRITE_ITEM },
      data,
    );
  }
}
export class MemberCannotAdminItem extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      { code: 'GERR004', statusCode: 403, message: FAILURE_MESSAGES.USER_CANNOT_ADMIN_ITEM },
      data,
    );
  }
}
export class InvalidMembership extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR005',
        statusCode: 400,
        message: FAILURE_MESSAGES.INVALID_MEMBERSHIP,
      },
      data,
    );
  }
}
export class ItemMembershipNotFound extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      { code: 'GERR006', statusCode: 404, message: FAILURE_MESSAGES.ITEM_MEMBERSHIP_NOT_FOUND },
      data,
    );
  }
}
export class ModifyExisting extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      {
        code: 'GERR007',
        statusCode: 400,
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
        statusCode: 400,
        message: FAILURE_MESSAGES.INVALID_PERMISSION_LEVEL,
      },
      data,
    );
  }
}
export class HierarchyTooDeep extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR009', statusCode: 403, message: FAILURE_MESSAGES.HIERARCHY_TOO_DEEP }, data);
  }
}
export class TooManyChildren extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR010', statusCode: 403, message: FAILURE_MESSAGES.TOO_MANY_CHILDREN }, data);
  }
}
export class TooManyDescendants extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      { code: 'GERR011', statusCode: 403, message: FAILURE_MESSAGES.TOO_MANY_DESCENDANTS },
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
      { code: 'GERR014', statusCode: 403, message: FAILURE_MESSAGES.CANNOT_MODIFY_OTHER_MEMBERS },
      data,
    );
  }
}
export class TooManyMemberships extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      { code: 'GERR015', statusCode: 403, message: FAILURE_MESSAGES.TOO_MANY_MEMBERSHIP },
      data,
    );
  }
}
export class MemberCannotAccess extends BaseGraaspError {
  constructor(data?: unknown) {
    super(
      { code: 'GERR016', statusCode: 403, message: FAILURE_MESSAGES.MEMBER_CANNOT_ACCESS },
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
