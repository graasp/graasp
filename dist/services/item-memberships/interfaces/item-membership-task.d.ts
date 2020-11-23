import { Task } from '../../../interfaces/task';
import { Member } from '../../../services/members/interfaces/member';
import { ItemMembership } from './item-membership';
export interface ItemMembershipTask extends Task<Member, ItemMembership> {
    /**
     * Id of the item to which the ItemMembership is linked to
     */
    itemId?: string;
}
