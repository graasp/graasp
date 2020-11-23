import { ItemMembership, PermissionLevel } from './interfaces/item-membership';
export declare class BaseItemMembership implements ItemMembership {
    readonly id: string;
    readonly memberId: string;
    readonly itemPath: string;
    permission: PermissionLevel;
    readonly creator: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    constructor(memberId: string, itemPath: string, permission: PermissionLevel, creator: string);
}
