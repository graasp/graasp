import { AccessDenied, NotFound, WebSocketService } from 'graasp-websockets';
import { Actor } from '../../../interfaces/actor';
import { TaskRunner } from '../../../interfaces/task-runner';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { ItemMembershipService } from '../../item-memberships/db-service';
import { ItemService } from '../db-service';
import { Item } from '../interfaces/item';
import { ItemTaskManager } from '../interfaces/item-task-manager';
import {
  ChildItemEvent,
  itemTopic,
  memberItemsTopic,
  OwnItemsEvent,
  SelfItemEvent,
  SharedItemsEvent,
} from './events';

// helper function to find parent of item given path
export function getParentId(itemPath: string): string | undefined {
  const tokens = itemPath.split('.');
  return tokens.length >= 2 ? tokens[tokens.length - 2].replace(/_/g, '-') : undefined;
}

/**
 * helper to register item topic
 */
function registerItemTopic(
  websockets: WebSocketService,
  runner: TaskRunner<Actor>,
  itemService: ItemService,
  itemMembershipService: ItemMembershipService,
  itemTaskManager: ItemTaskManager,
  validationDbHandler: DatabaseTransactionHandler
) {
  websockets.register(itemTopic, async (req) => {
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

  // on create item, notify parent of new child
  const createItemTaskName = itemTaskManager.getCreateTaskName();
  runner.setTaskPostHookHandler<Item>(createItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('create', item));
    }
  });

  // on update item
  // - notify item itself of update
  // - notify parent of updated child
  const updateItemTaskName = itemTaskManager.getUpdateTaskName();
  runner.setTaskPostHookHandler<Item>(updateItemTaskName, async (item) => {
    websockets.publish(itemTopic, item.id, SelfItemEvent('update', item));
  });
  runner.setTaskPostHookHandler<Item>(updateItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('update', item));
    }
  });

  // on delete item
  // - notify item itself of deletion
  // - notify parent of deleted child
  const deleteItemTaskName = itemTaskManager.getDeleteTaskName();
  runner.setTaskPostHookHandler<Item>(deleteItemTaskName, async (item) => {
    websockets.publish(itemTopic, item.id, SelfItemEvent('delete', item));
  });
  runner.setTaskPostHookHandler<Item>(deleteItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('delete', item));
    }
  });

  // on copy item, notify destination parent of new child
  const copyItemTaskName = itemTaskManager.getCopyTaskName();
  runner.setTaskPostHookHandler<Item>(copyItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('create', item));
    }
  });

  // on move item, notify:
  // - parent of old location of deleted child
  // - parent of new location of new child
  const moveItemTaskName = itemTaskManager.getMoveTaskName();
  runner.setTaskPreHookHandler<Item>(moveItemTaskName, async (partialItem, actor, { handler }) => {
    if (!partialItem.id) {
      return;
    }
    const item = await itemService.get(partialItem.id, handler);
    if (!item) {
      return;
    }
    const parentId = getParentId(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('delete', item));
    }
  });
  runner.setTaskPostHookHandler<Item>(moveItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('create', item));
    }
  });
}

/**
 * helper to register items of member topic
 */
function registerMemberItemsTopic(
  websockets: WebSocketService,
  runner: TaskRunner<Actor>,
  itemService: ItemService,
  itemTaskManager: ItemTaskManager
) {
  websockets.register(memberItemsTopic, async (req) => {
    const { channel: memberId, member, reject } = req;
    // requeted memberId channel must be current member
    if (memberId !== member.id) {
      reject(AccessDenied());
    }
  });

  // on create, notify own items of creator with new item IF path is root
  const createItemTaskName = itemTaskManager.getCreateTaskName();
  runner.setTaskPostHookHandler<Item>(createItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator, OwnItemsEvent('create', item));
    }
  });

  // on update
  // - notify own items of creator with updated item IF path is root
  // - notify members that have memberships on this item of update
  const updateItemTaskName = itemTaskManager.getUpdateTaskName();
  runner.setTaskPostHookHandler<Item>(updateItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator, OwnItemsEvent('update', item));
    }
  });
  runner.setTaskPostHookHandler<Item>(updateItemTaskName, async (item, actor, { handler }) => {
    const members = await itemService.membersWithSharedItem(item.path, handler);
    if (!members || !Array.isArray(members)) {
      return;
    }
    members.forEach((memberId) => {
      websockets.publish(memberItemsTopic, memberId, SharedItemsEvent('update', item));
    });
  });

  // on delete
  // - notify own items of creator of deleted item IF path is root
  // - notify members that have memberships on this item of delete
  //   (before with prehook, otherwise memberships lost on cascade from db!)
  const deleteItemTaskName = itemTaskManager.getDeleteTaskName();
  runner.setTaskPostHookHandler<Item>(deleteItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator, OwnItemsEvent('delete', item));
    }
  });
  runner.setTaskPreHookHandler<Item>(
    deleteItemTaskName,
    async (partialItem, actor, { handler }) => {
      if (!partialItem.id) {
        return;
      }
      const item = await itemService.get(partialItem.id, handler);
      if (!item) {
        return;
      }
      const members = await itemService.membersWithSharedItem(item.path, handler);
      if (!members || !Array.isArray(members)) {
        return;
      }
      members.forEach((memberId) => {
        websockets.publish(memberItemsTopic, memberId, SharedItemsEvent('delete', item));
      });
    }
  );

  // on copy, notify own items of creator with new item IF destination is root
  const copyItemTaskName = itemTaskManager.getCopyTaskName();
  runner.setTaskPostHookHandler<Item>(copyItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator, OwnItemsEvent('create', item));
    }
  });

  // on move item:
  // - notify own items of creator of delete IF old location was root
  // - notify own items of creator of create IF new location is root
  const moveItemTaskName = itemTaskManager.getMoveTaskName();
  runner.setTaskPreHookHandler<Item>(moveItemTaskName, async (partialItem, actor, { handler }) => {
    if (!partialItem.id) {
      return;
    }
    const item = await itemService.get(partialItem.id, handler);
    if (!item) {
      return;
    }
    const parentId = getParentId(item.path);
    if (parentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator, OwnItemsEvent('delete', item));
    }
  });
  runner.setTaskPostHookHandler<Item>(moveItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator, OwnItemsEvent('create', item));
    }
  });
}

/**
 * Registers real-time websocket events for the item service
 * @param websockets Websocket service instance of the server
 * @param runner TaskRunner executor of the server
 * @param itemService Item database layer
 * @param itemMembershipService ItemMembership database layer
 * @param itemTaskManager Item task manager
 * @param validationDbHandler Database transaction handler used to validate subscriptions
 */
export function registerItemWsHooks(
  websockets: WebSocketService,
  runner: TaskRunner<Actor>,
  itemService: ItemService,
  itemMembershipService: ItemMembershipService,
  itemTaskManager: ItemTaskManager,
  validationDbHandler: DatabaseTransactionHandler
): void {
  registerItemTopic(
    websockets,
    runner,
    itemService,
    itemMembershipService,
    itemTaskManager,
    validationDbHandler
  );

  registerMemberItemsTopic(websockets, runner, itemService, itemTaskManager);
}
