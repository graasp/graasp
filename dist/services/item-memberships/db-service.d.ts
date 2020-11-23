import { DatabaseTransactionConnectionType as TrxHandler } from 'slonik';
import { Item } from '../../services/items/interfaces/item';
import { Member } from '../../services/members/interfaces/member';
import { ItemMembership, PermissionLevel } from './interfaces/item-membership';
export declare class ItemMembershipService {
    private static allColumns;
    /**
     * Get the permission level of a membership given the `member` and `item`.
     * @param member Member in membership
     * @param item Item whose path is referenced in membership
     * @param transactionHandler Database transaction handler
     */
    getPermissionLevel(member: Member, item: Item, transactionHandler: TrxHandler): Promise<PermissionLevel>;
    /**
     * Get the 'best/nearest' membership to the given `item` for `member`.
     * If `includeOwn`, also include membership targeting this `member`+`item`.
     * @param member Member in membership
     * @param item Item whose path should be considered
     * @param transactionHandler Database transaction handler
     * @param considerLocal Also consider a (possible) membership targeting this `item` for this `member`
     */
    getInherited(member: Member, item: Item, transactionHandler: TrxHandler, considerLocal?: boolean): Promise<ItemMembership>;
    /**
     * Get all memberships "below" the given `item`'s path, for the given `member`, ordered by
     * longest to shortest path - lowest in the (sub)tree to highest in the (sub)tree.
     * @param member Member in membership
     * @param item Item whose path should be considered
     * @param transactionHandler Database transaction handler
     * @param considerLocal Also consider a (possible) membership targeting this `item` for this `member`
     */
    getAllBelow(member: Member, item: Item, transactionHandler: TrxHandler, considerLocal?: boolean): Promise<ItemMembership[]>;
    /**
     * Get all the 'best/nearest' memberships for the given `item` for each member
     * with access to it.
     * @param item Item whose path should be considered
     * @param transactionHandler Database transaction handler
     */
    getInheritedForAll(item: Item, transactionHandler: TrxHandler): Promise<ItemMembership[]>;
    /**
     * Check if given `member` can `read` given `item`.
     * @param member Member
     * @param item Item
     * @param transactionHandler Database transaction handler
     */
    canRead(member: Member, item: Item, transactionHandler: TrxHandler): Promise<boolean>;
    /**
     * Check if given `member` can `write` given `item`.
     * @param member Member
     * @param item Item
     * @param transactionHandler Database transaction handler
     */
    canWrite(member: Member, item: Item, transactionHandler: TrxHandler): Promise<boolean>;
    /**
     * Check if given `member` can `admin` given `item`.
     * @param member Member
     * @param item Item
     * @param transactionHandler Database transaction handler
     */
    canAdmin(member: Member, item: Item, transactionHandler: TrxHandler): Promise<boolean>;
    /**
     * Get membership by its `id`.
     * @param id Membership unique id
     * @param transactionHandler Database transaction handler
     */
    get(id: string, transactionHandler: TrxHandler): Promise<ItemMembership>;
    /**
     * Create membership.
     * @param membership Partial membership object with `memberId`, `itemPath`, `permission`, `creator`.
     * @param transactionHandler Database transaction handler
     */
    create(membership: Partial<ItemMembership>, transactionHandler: TrxHandler): Promise<ItemMembership>;
    /**
     * Create multiple memberships given an array of partial membership objects.
     * @param memberships Array of objects with properties: `memberId`, `itemPath`, `permission`, `creator`
     * @param transactionHandler Database transaction handler
     */
    createMany(memberships: Partial<ItemMembership>[], transactionHandler: TrxHandler): Promise<readonly ItemMembership[]>;
    /**
     * Update membership's permission.
     * @param id Membership id
     * @param permission New permission value
     * @param transactionHandler Database transaction handler
     */
    update(id: string, permission: PermissionLevel, transactionHandler: TrxHandler): Promise<ItemMembership>;
    /**
     * Delete membership.
     * @param id Membership id
     * @param transactionHandler Database transaction handler
     */
    delete(id: string, transactionHandler: TrxHandler): Promise<ItemMembership>;
    /**
     * Delete multiple memberships matching `memberId`+`itemPath`
     * from partial memberships in given array.
     * @param memberships List of objects with: `memberId`, `itemPath`
     * @param transactionHandler Database transaction handler
     */
    deleteManyMatching(memberships: Partial<ItemMembership>[], transactionHandler: TrxHandler): Promise<readonly ItemMembership[]>;
    /**
     * Identify any new memberships to be created, and any existing memberships to be
     * removed, after moving the item. These are adjustmnents necessary
     * to keep the constraints in the memberships:
     *
     * * members inherit membership permissions from memberships in items 'above'
     * * memberships 'down the tree' can only improve on the permission level and cannot repeat: read > write > admin
     *
     * ** Needs to run before the actual item move **
     * @param item Item that will be moved
     * @param member Member used as `creator` for any new memberships
     * @param transactionHandler Database transaction handler
     * @param newParentItem Parent item to where `item` will be moved to
     */
    moveHousekeeping(item: Item, member: Member, transactionHandler: TrxHandler, newParentItem?: Item): Promise<{
        inserts: Partial<ItemMembership>[];
        deletes: Partial<ItemMembership>[];
    }>;
    private getPermissionsAtItemSql;
    /**
     * Identify any new memberships that will be necessary to create
     * after moving the item from its parent item to *no-parent*.
     *
     * Moving to *no-parent* is simpler so this method is used instead of `moveHousekeeping()`.
     * @param item Item that will be moved
     * @param member Member used as `creator` for any new memberships
     * @param transactionHandler Database transaction handler
     */
    private detachedMoveHousekeeping;
}
