import { FastifyError } from 'fastify';

type ErrorOrigin = 'core' | 'plugin' | string;

export interface GraaspError extends FastifyError {
  data?: unknown;
  origin: ErrorOrigin
}

export interface GraaspErrorDetails {
  code: string;
  message: string;
  statusCode: number;
}

export abstract class BaseGraaspError implements GraaspError {
  name: string;
  code: string
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
    super({ code: 'GERR001', statusCode: 404, message: 'Item not found' }, data);
  }
}
export class UserCannotReadItem extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR002', statusCode: 403, message: 'User cannot read item' }, data);
  }
}
export class UserCannotWriteItem extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR003', statusCode: 403, message: 'User cannot write item' }, data);
  }
}
export class UserCannotAdminItem extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR004', statusCode: 403, message: 'User cannot admin item' }, data);
  }
}
export class InvalidMembership extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR005', statusCode: 400, message: 'Membership with this permission level cannot be created for this member in this item' }, data);
  }
}
export class ItemMembershipNotFound extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR006', statusCode: 404, message: 'Item membership not found' }, data);
  }
}
export class ModifyExisting extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR007', statusCode: 400, message: 'Cannot create membership for member in item. Should modify existing one' }, data);
  }
}
export class InvalidPermissionLevel extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR008', statusCode: 400, message: 'Cannot change to a worse permission level than the one inherited' }, data);
  }
}
export class HierarchyTooDeep extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR009', statusCode: 403, message: 'Hierarchy too deep' }, data);
  }
}
export class TooManyChildren extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR010', statusCode: 403, message: 'Too many children' }, data);
  }
}
export class TooManyDescendants extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR011', statusCode: 403, message: 'Too many descendants' }, data);
  }
}
export class InvalidMoveTarget extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR012', statusCode: 400, message: 'Invalid item to move to' }, data);
  }
}
export class MemberNotFound extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR013', statusCode: 404, message: 'Member not found' }, data);
  }
}
export class CannotModifyOtherMembers extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR014', statusCode: 403, message: 'Member cannot modify other member' }, data);
  }
}
export class DatabaseError extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR998', statusCode: 500, message: 'Database error' }, data);
  }
}
export class UnexpectedError extends BaseGraaspError {
  constructor(data?: unknown) {
    super({ code: 'GERR999', statusCode: 500, message: 'Unexpected error' }, data);
  }
}
