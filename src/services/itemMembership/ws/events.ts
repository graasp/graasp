/**
 * Membership websocket events are registered under these topics
 */
import { ItemMembership } from '../entities/ItemMembership.js';

// memberships of a given item
export const itemMembershipsTopic = 'memberships/item';

/**
 * All websocket events for memberships will have this shape
 */
export type MembershipEvent = {
  kind: string;
  op: string;
  membership: ItemMembership;
};

/**
 * Events that affect memberships on items
 */
type ItemMembershipEvent = {
  kind: 'item';
  op: 'create' | 'update' | 'delete';
  membership: ItemMembership;
} & MembershipEvent;

/**
 * Factory of ItemMembershipEvent
 * @param op operation of the event
 * @param membership value of the membership for this event
 * @returns instance of item membership event
 */

export const ItemMembershipEvent = (
  op: ItemMembershipEvent['op'],
  membership: ItemMembership,
): ItemMembershipEvent => ({
  kind: 'item',
  op,
  membership,
});
