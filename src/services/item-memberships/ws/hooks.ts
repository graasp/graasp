import {
  Actor,
  DatabaseTransactionHandler,
  ItemMembership,
  ItemMembershipService,
  ItemMembershipTaskManager,
  ItemService,
  TaskRunner,
  getChildFromPath,
} from '@graasp/sdk';
import { AccessDenied, NotFound, WebSocketService } from 'graasp-plugin-websockets';

import { SharedItemsEvent, memberItemsTopic } from '../../items/ws/events';
import { ItemMembershipEvent, itemMembershipsTopic } from './events';

/**
 * Registers real-time websocket events for the item memberships service
 * @param websockets Websocket service instance of the server
 * @param runner TaskRunner executor of the server
 * @param itemService Item database layer
 * @param itemMembershipService ItemMembership database layer
 * @param itemMembershipTaskManager ItemMembership task manager
 * @param validationDbHandler Database transaction handler used to validate subscriptions
 */
export function registerItemMembershipWsHooks(
  websockets: WebSocketService,
  runner: TaskRunner<Actor>,
  itemService: ItemService,
  itemMembershipService: ItemMembershipService,
  itemMembershipTaskManager: ItemMembershipTaskManager,
  validationDbHandler: DatabaseTransactionHandler,
): void {
  websockets.register(itemMembershipsTopic, async (req) => {
    const { channel: itemId, member, reject } = req;
    // item must exist
    const item = await itemService.get(itemId, validationDbHandler);
    if (!item) {
      reject(NotFound());
    }
    // member must have at least read access to item
    const allowed = await itemMembershipService.canRead(member.id, item, validationDbHandler);
    if (!allowed) {
      reject(AccessDenied());
    }
  });

  // on create:
  // - notify member of new shared item IF creator != member
  // - notify item itself of new membership
  const createItemMembershipTaskName = itemMembershipTaskManager.getCreateTaskName();
  runner.setTaskPostHookHandler<ItemMembership>(
    createItemMembershipTaskName,
    async (membership, actor, { handler }) => {
      const itemId = getChildFromPath(membership.itemPath);
      const item = await itemService.get(itemId, handler);
      if (!item) {
        return;
      }
      if (membership.memberId !== item.creator) {
        websockets.publish(memberItemsTopic, membership.memberId, SharedItemsEvent('create', item));
      }
      websockets.publish(itemMembershipsTopic, item.id, ItemMembershipEvent('create', membership));
    },
  );

  // on update notify item itself of updated membership
  const updateItemMembershipTaskName = itemMembershipTaskManager.getUpdateTaskName();
  runner.setTaskPostHookHandler<ItemMembership>(
    updateItemMembershipTaskName,
    async (membership, actor, { handler }) => {
      const itemId = getChildFromPath(membership.itemPath);
      const item = await itemService.get(itemId, handler);
      if (!item) {
        return;
      }
      websockets.publish(itemMembershipsTopic, item.id, ItemMembershipEvent('update', membership));
    },
  );

  // on delete
  // - notify member of deleted shared item
  // - notify item itself of deleted membership
  const deleteItemMembershipTaskName = itemMembershipTaskManager.getDeleteTaskName();
  runner.setTaskPostHookHandler<ItemMembership>(
    deleteItemMembershipTaskName,
    async (membership, actor, { handler }) => {
      const itemId = getChildFromPath(membership.itemPath);
      const item = await itemService.get(itemId, handler);
      if (!item) {
        return;
      }
      websockets.publish(memberItemsTopic, membership.memberId, SharedItemsEvent('delete', item));
      websockets.publish(itemMembershipsTopic, item.id, ItemMembershipEvent('delete', membership));
    },
  );
}
