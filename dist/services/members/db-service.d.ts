import { DatabaseTransactionConnectionType as TrxHandler } from 'slonik';
import { Member } from './interfaces/member';
/**
 * Database's first layer of abstraction for Members
 */
export declare class MemberService {
    private static allColumns;
    /**
     * Get member(s) matching the properties of the given (partial) member.
     * @param member Partial member
     * @param dbHandler Database handler
     * @param properties List of Member properties to fetch - defaults to 'all'
     */
    getMatching(member: Partial<Member>, dbHandler: TrxHandler, properties?: (keyof Member)[]): Promise<Partial<Member>[]>;
    /**
     * Get member matching the given `id` or `null`, if not found.
     * @param id Member's id
     * @param dbHandler Database handler
     * @param properties List of Member properties to fetch - defaults to 'all'
     */
    get(id: string, dbHandler: TrxHandler, properties?: (keyof Member)[]): Promise<Partial<Member>>;
    /**
     * Create member and return it.
     * @param member Member to create
     * @param transactionHandler Database transaction handler
     */
    create(member: Partial<Member>, transactionHandler: TrxHandler): Promise<Member>;
}
