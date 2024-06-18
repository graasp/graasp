import { FastifyPluginAsync } from 'fastify';

import { Repositories, buildRepositories } from '../../../utils/repositories.js';
import { ItemService } from '../../item/service.js';
import { WebsocketService } from '../../websockets/ws-service.js';
import { ItemMembershipService } from '../service.js';
import { ItemMembershipEvent, itemMembershipsTopic } from './events.js';

export function registerItemMembershipWsHooks(
  repositories: Repositories,
  websockets: WebsocketService,
  itemService: ItemService,
  itemMembershipService: ItemMembershipService,
): void {
  websockets.register(itemMembershipsTopic, async (req) => {
    const { channel: itemId, member } = req;
    // item must exist with read permission, else exception is thrown
    await itemService.get(member, repositories, itemId);
  });

  // on create:
  // - notify member of new shared item IF creator != member
  // - notify item itself of new membership
  itemMembershipService.hooks.setPostHook('create', async (member, repositories, membership) => {
    // TODO: should it also check that there is no stronger or equal permission for this member on the item ancestors?
    // example: it should not be possible to create a weaker permission in the subtree of an ancestor that already has a membership
    websockets.publish(
      itemMembershipsTopic,
      membership.item.id,
      ItemMembershipEvent('create', membership),
    );

    // TODO: should it also iterate over the descendants and send a new membership on each of them IF there is no stronger permission for this member on each?
    // example: when viewing an item in the subtree of this item, should it receive this permission since it inherits from it? However, this should only be done if this new permission is stronger or equal to any existing one on the child
  });

  // on update notify item itself of updated membership
  itemMembershipService.hooks.setPostHook('update', async (member, repositories, membership) => {
    // TODO: should it check if the change is weaker than a membership on the item ancestors and thus "replace" it with the stronger ancestor one?
    // example: if an ancestor of this item has permission write, it should not be possible for this child item permission to be changed from admin to write
    websockets.publish(
      itemMembershipsTopic,
      membership.item.id,
      ItemMembershipEvent('update', membership),
    );

    // TODO: should it also iterate over the descendants and update the membership on each of them IF there is no stronger permission for this member on each?
    // example: an item in the subtree should inherit this permission update, but if it already had a stronger permission, the latter should take precedence
  });

  // on delete
  // - notify member of deleted shared item
  // - notify item itself of deleted membership
  itemMembershipService.hooks.setPostHook('delete', async (member, repositories, membership) => {
    // TODO: should it also check that there is no stronger or equal permission for this member on the item ancestors and thus "replace" it with the stronger ancestor one?
    // example: if an ancestor of this item has permission write, and the current permission being deleted is admin, then the item should have already received the former membership instead
    websockets.publish(
      itemMembershipsTopic,
      membership.item.id,
      ItemMembershipEvent('delete', membership),
    );

    // TODO: should it also iterate over the descendants and remove the membership on each of them IF there is no stronger permission for this member on each?
    // example: an item in the subtree was inheriting this permission, so if it's removed then it should removed from the child item as well, unless there already is a stronger permission on it
  });
}

/**
 * Registers real-time websocket events for the item service
 */
export const membershipWsHooks: FastifyPluginAsync = async (fastify) => {
  const { websockets, items, memberships } = fastify;
  registerItemMembershipWsHooks(
    buildRepositories(),
    websockets,
    items.service,
    memberships.service,
  );
};
