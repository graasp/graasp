import { FastifyError } from 'fastify';

export interface GraaspErrorDetails {
  code: string;
  message: string;
  statusCode: number;
}

export enum GraaspErrorCode {
  ItemNotFound = 'GERR001',
  UserCannotReadItem = 'GERR002',
  UserCannotWriteItem = 'GERR003',
  UserCannotAdminItem = 'GERR004',
  InvalidMembership = 'GERR005',
  ItemMembershipNotFound = 'GERR006',
  ModifyExisting = 'GERR007',
  InvalidPermissionLevel = 'GERR008',
  HierarchyTooDeep = 'GERR009',
  TooManyChildren = 'GERR010',
  TooManyDescendants = 'GERR011',
  InvalidMoveTarget = 'GERR012',
  MemberNotFound = 'GERR013',

  // generic
  DatabaseError = 'GERR998',
  UnknownError = 'GERR999'
}

export class GraaspError implements FastifyError {
  static readonly ItemNotFound =
    { code: GraaspErrorCode.ItemNotFound, statusCode: 404, message: 'Item not found' };
  static readonly UserCannotReadItem =
    { code: GraaspErrorCode.UserCannotReadItem, statusCode: 403, message: 'User cannot read item' };
  static readonly UserCannotWriteItem =
    { code: GraaspErrorCode.UserCannotWriteItem, statusCode: 403, message: 'User cannot write item' };
  static readonly UserCannotAdminItem =
    { code: GraaspErrorCode.UserCannotAdminItem, statusCode: 403, message: 'User cannot admin item' };
  static readonly InvalidMembership =
    { code: GraaspErrorCode.InvalidMembership, statusCode: 400, message: 'Membership with this permission level cannot be created for this member in this item' };
  static readonly ItemMembershipNotFound =
    { code: GraaspErrorCode.ItemMembershipNotFound, statusCode: 404, message: 'Item membership not found' };
  static readonly ModifyExisting =
    { code: GraaspErrorCode.ModifyExisting, statusCode: 400, message: 'Cannot create membership for member in item. Should modify existing one' };
  static readonly InvalidPermissionLevel =
    { code: GraaspErrorCode.InvalidPermissionLevel, statusCode: 400, message: 'Cannot change to a worse permission level than the one inherited' };
  static readonly HierarchyTooDeep =
    { code: GraaspErrorCode.HierarchyTooDeep, statusCode: 403, message: 'Hierarchy too deep' };
  static readonly TooManyChildren =
    { code: GraaspErrorCode.TooManyChildren, statusCode: 403, message: 'Too many children' };
  static readonly TooManyDescendants =
    { code: GraaspErrorCode.TooManyDescendants, statusCode: 403, message: 'Too many descendants' };
  static readonly InvalidMoveTarget =
    { code: GraaspErrorCode.InvalidMoveTarget, statusCode: 400, message: 'Invalid item to move to' };
  static readonly MemberNotFound =
    { code: GraaspErrorCode.MemberNotFound, statusCode: 404, message: 'Member not found' };

  // generic
  static readonly DatabaseError =
    { code: GraaspErrorCode.DatabaseError, statusCode: 500, message: 'Database error' };
  static readonly UnknownError =
    { code: GraaspErrorCode.UnknownError, statusCode: 500, message: 'Unknown error' };

  name: string;
  code: string
  message: string;
  statusCode?: number;
  data: unknown;

  constructor({ code, statusCode, message }: GraaspErrorDetails, data?: unknown) {
    this.name = code;
    this.code = code;
    this.message = message;
    this.statusCode = statusCode;
    this.data = data;
  }
}
