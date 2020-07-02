import { FastifyError } from 'fastify';

export interface GraaspErrorDetails {
  name: string;
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
    { name: GraaspErrorCode.ItemNotFound, statusCode: 404, message: 'Item not found' };
  static readonly UserCannotReadItem =
    { name: GraaspErrorCode.UserCannotReadItem, statusCode: 403, message: 'User cannot read item' };
  static readonly UserCannotWriteItem =
    { name: GraaspErrorCode.UserCannotWriteItem, statusCode: 403, message: 'User cannot write item' };
  static readonly UserCannotAdminItem =
    { name: GraaspErrorCode.UserCannotAdminItem, statusCode: 403, message: 'User cannot admin item' };
  static readonly InvalidMembership =
    { name: GraaspErrorCode.InvalidMembership, statusCode: 400, message: 'Membership with this permission level cannot be created for this member in this item' };
  static readonly ItemMembershipNotFound =
    { name: GraaspErrorCode.ItemMembershipNotFound, statusCode: 404, message: 'Item membership not found' };
  static readonly ModifyExisting =
    { name: GraaspErrorCode.ModifyExisting, statusCode: 400, message: 'Cannot create membership for member in item. Should modify existing one' };
  static readonly InvalidPermissionLevel =
    { name: GraaspErrorCode.InvalidPermissionLevel, statusCode: 400, message: 'Cannot change to a worse permission level than the one inherited' };
  static readonly HierarchyTooDeep =
    { name: GraaspErrorCode.HierarchyTooDeep, statusCode: 403, message: 'Hierarchy too deep' };
  static readonly TooManyChildren =
    { name: GraaspErrorCode.TooManyChildren, statusCode: 403, message: 'Too many children' };
  static readonly TooManyDescendants =
    { name: GraaspErrorCode.TooManyDescendants, statusCode: 403, message: 'Too many descendants' };
  static readonly InvalidMoveTarget =
    { name: GraaspErrorCode.InvalidMoveTarget, statusCode: 400, message: 'Invalid item to move to' };
  static readonly MemberNotFound =
    { name: GraaspErrorCode.MemberNotFound, statusCode: 404, message: 'Member not found' };

  // generic
  static readonly DatabaseError =
    { name: GraaspErrorCode.DatabaseError, statusCode: 500, message: 'Database error' };
  static readonly UnknownError =
    { name: GraaspErrorCode.UnknownError, statusCode: 500, message: 'Unknown error' };

  statusCode?: number;
  name: string;
  message: string;
  data: unknown;

  constructor({ name, statusCode, message }: GraaspErrorDetails, data?: unknown) {
    this.name = name;
    this.message = message;
    this.statusCode = statusCode;
    this.data = data;
  }
}
