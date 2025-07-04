/**
 * Membership websocket events are registered under these topics
 */
import type { ItemMembershipRaw } from '../../../drizzle/types';

// memberships of a given item
export const itemMembershipsTopic = 'memberships/item';

/**
 * All websocket events for memberships will have this shape
 */
export interface MembershipEvent {
  kind: string;
  op: string;
  membership: ItemMembershipRaw;
}

/**
 * Events that affect memberships on items
 */
interface ItemMembershipEvent extends MembershipEvent {
  kind: 'item';
  op: 'create' | 'update' | 'delete';
  membership: ItemMembershipRaw;
}

/**
 * Factory of ItemMembershipEvent
 * @param op operation of the event
 * @param membership value of the membership for this event
 * @returns instance of item membership event
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const ItemMembershipEvent = (
  op: ItemMembershipEvent['op'],
  membership: ItemMembershipRaw,
): ItemMembershipEvent => ({
  kind: 'item',
  op,
  membership,
});
