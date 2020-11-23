import { FastifyError } from 'fastify';
export interface GraaspErrorDetails {
    code: string;
    message: string;
    statusCode: number;
}
export declare enum GraaspErrorCode {
    ItemNotFound = "GERR001",
    UserCannotReadItem = "GERR002",
    UserCannotWriteItem = "GERR003",
    UserCannotAdminItem = "GERR004",
    InvalidMembership = "GERR005",
    ItemMembershipNotFound = "GERR006",
    ModifyExisting = "GERR007",
    InvalidPermissionLevel = "GERR008",
    HierarchyTooDeep = "GERR009",
    TooManyChildren = "GERR010",
    TooManyDescendants = "GERR011",
    InvalidMoveTarget = "GERR012",
    MemberNotFound = "GERR013",
    DatabaseError = "GERR998",
    UnknownError = "GERR999"
}
export declare class GraaspError implements FastifyError {
    static readonly ItemNotFound: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly UserCannotReadItem: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly UserCannotWriteItem: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly UserCannotAdminItem: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly InvalidMembership: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly ItemMembershipNotFound: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly ModifyExisting: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly InvalidPermissionLevel: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly HierarchyTooDeep: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly TooManyChildren: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly TooManyDescendants: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly InvalidMoveTarget: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly MemberNotFound: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly DatabaseError: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    static readonly UnknownError: {
        code: GraaspErrorCode;
        statusCode: number;
        message: string;
    };
    name: string;
    code: string;
    message: string;
    statusCode?: number;
    data: unknown;
    constructor({ code, statusCode, message }: GraaspErrorDetails, data?: unknown);
}
