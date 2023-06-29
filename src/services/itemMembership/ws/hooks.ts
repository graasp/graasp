import { FastifyPluginAsync } from 'fastify';

import { PermissionLevel } from '@graasp/sdk';

import { Repositories, buildRepositories } from '../../../utils/repositories';
import ItemService from '../../item/service';
import { SharedItemsEvent, memberItemsTopic } from '../../item/ws/events';
import { WebsocketService } from '../../websockets/ws-service';
import ItemMembershipService from '../service';
import { ItemMembershipEvent, itemMembershipsTopic } from './events';

export function registerItemMembershipWsHooks(
  repositories: Repositories,
  websockets: WebsocketService,
  itemService: ItemService,
  itemMembershipService: ItemMembershipService,
): void {
  websockets.register(itemMembershipsTopic, async (req) => {
    const { channel: itemId, member } = req;
    // item must exist with read permission, else exception is thrown
    await itemService.get(member, repositories, itemId, PermissionLevel.Read);
  });

  // on create:
  // - notify member of new shared item IF creator != member
  // - notify item itself of new membership
  itemMembershipService.hooks.setPostHook('create', async (member, repositories, membership) => {
    if (membership.member.id !== membership.item.creator.id) {
      websockets.publish(
        memberItemsTopic,
        membership.member.id,
        SharedItemsEvent('create', membership.item),
      );
    }
    websockets.publish(
      itemMembershipsTopic,
      membership.item.id,
      ItemMembershipEvent('create', membership),
    );
  });

  // on update notify item itself of updated membership
  itemMembershipService.hooks.setPostHook('update', async (member, repositories, membership) => {
    websockets.publish(
      itemMembershipsTopic,
      membership.item.id,
      ItemMembershipEvent('update', membership),
    );
  });

  // on delete
  // - notify member of deleted shared item
  // - notify item itself of deleted membership
  itemMembershipService.hooks.setPostHook('delete', async (member, repositories, membership) => {
    websockets.publish(
      memberItemsTopic,
      membership.member.id,
      SharedItemsEvent('delete', membership.item),
    );
    websockets.publish(
      itemMembershipsTopic,
      membership.item.id,
      ItemMembershipEvent('delete', membership),
    );
  });
}

/**
 * Registers real-time websocket events for the item service
 */
export const membershipWsHooks: FastifyPluginAsync = async (fastify) => {
  const { websockets, items } = fastify;
  registerItemMembershipWsHooks(
    buildRepositories(),
    websockets,
    items.service,
    items.membserships.service,
  );
};
