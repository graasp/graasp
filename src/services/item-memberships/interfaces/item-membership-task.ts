// global
import { Task } from 'interfaces/task';
// other services
import { Member } from 'services/members/interfaces/member';
// local
import { ItemMembership } from './item-membership';

export interface ItemMembershipTask extends Task<Member, ItemMembership> {
  /**
   * Id of the item to which the ItemMembership is linked to
   */
  itemId?: string;
}
