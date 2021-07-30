import { AccessDenied, NotFound, WebSocketService } from "graasp-websockets";
import { Actor } from "../../../interfaces/actor";
import { TaskRunner } from "../../../interfaces/task-runner";
import { DatabaseTransactionHandler } from "../../../plugins/database";
import { ItemMembershipService } from "../../item-memberships/db-service";
import { ItemService } from "../db-service";
import { Item } from "../interfaces/item";
import { ItemTaskManager } from "../interfaces/item-task-manager";
import { ChildItemEvent, SelfItemEvent } from "./events";

// helper function to find parent of item given path
function getParentId(itemPath: string): string | undefined {
  const tokens = itemPath.split(".");
  return tokens.length >= 2 ? tokens[tokens.length - 2].replace(/_/g, "-") : undefined;
}

// helper function to extract child ID from item path
function extractChildId(itemPath: string): string {
  const tokens = itemPath.split(".");
  return tokens[tokens.length - 1].replace(/_/g, "-");
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
export function registerWsHooks(
  websockets: WebSocketService,
  runner: TaskRunner<Actor>,
  itemService: ItemService,
  itemMembershipService: ItemMembershipService,
  itemTaskManager: ItemTaskManager,
  validationDbHandler: DatabaseTransactionHandler
): void {
  const itemTopic = "item";

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
      websockets.publish(itemTopic, parentId, ChildItemEvent("create", item));
    }
  });

  // on update item
  // - notify item itself of update
  // - notify parent of updated child
  const updateItemTaskName = itemTaskManager.getUpdateTaskName();
  runner.setTaskPostHookHandler<Item>(updateItemTaskName, async (item) => {
    websockets.publish(itemTopic, item.id, SelfItemEvent("update", item));
  });
  runner.setTaskPostHookHandler<Item>(updateItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent("update", item));
    }
  });

  // on delete item
  // - notify item itself of deletion
  // - notify parent of deleted child
  const deleteItemTaskName = itemTaskManager.getDeleteTaskName();
  runner.setTaskPostHookHandler<Item>(deleteItemTaskName, async (item) => {
    websockets.publish(itemTopic, item.id, SelfItemEvent("delete", item));
  });
  runner.setTaskPostHookHandler<Item>(deleteItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent("delete", item));
    }
  });

  // on copy item, notify destination parent of new child
  const copyItemTaskName = itemTaskManager.getCopyTaskName();
  runner.setTaskPostHookHandler<Item>(copyItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent("create", item));
    }
  });

  // on move item, notify:
  // - parent of old location of deleted child
  // - parent of new location of new child
  const moveItemTaskName = itemTaskManager.getMoveTaskName();
  runner.setTaskPreHookHandler<Item>(moveItemTaskName, async (partialItem, actor, { handler }) => {
    const item = await itemService.get(partialItem.id, handler);
    if (!item) {
      return;
    }
    const parentId = getParentId(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent("delete", item));
    }
  });
  runner.setTaskPostHookHandler<Item>(moveItemTaskName, async (item) => {
    const parentId = getParentId(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent("create", item));
    }
  });
}
