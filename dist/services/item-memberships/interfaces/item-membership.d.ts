export declare enum PermissionLevel {
    Read = "read",
    Write = "write",
    Admin = "admin"
}
export declare class PermissionLevelCompare {
    /**
     * `a` is a better permission level when compared to `b`
     */
    static gt: (a: PermissionLevel, b: PermissionLevel) => boolean;
    /**
     * `a` is a better, or the same, permission level when compared to `b`.
     */
    static gte: (a: PermissionLevel, b: PermissionLevel) => boolean;
    /**
     * `a` is a worse permission level when compared to `b`.
     */
    static lt: (a: PermissionLevel, b: PermissionLevel) => boolean;
    /**
     * `a` is a worse, or the same, permission level when compared to `b`.
     */
    static lte: (a: PermissionLevel, b: PermissionLevel) => boolean;
}
export interface ItemMembership {
    id: string;
    memberId: string;
    itemPath: string;
    permission: PermissionLevel;
    creator: string;
    createdAt: string;
    updatedAt: string;
}
