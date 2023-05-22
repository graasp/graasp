import { FastifyPluginAsync } from 'fastify';

import { Item, Websocket, getParentFromPath } from '@graasp/sdk';

import { buildRepositories } from '../../../utils/repositories';
import { WebsocketService } from '../../websockets/ws-service';
import ItemService from '../service';
import {
  ChildItemEvent,
  OwnItemsEvent,
  SelfItemEvent,
  SharedItemsEvent,
  itemTopic,
  memberItemsTopic,
} from './events';

/**
 * helper to register item topic
 */
function registerItemTopic(websockets: WebsocketService, itemService: ItemService) {
  websockets.register(itemTopic, async (req) => {
    const { channel: id, member } = req;
    await itemService.get(member, buildRepositories(), id);
  });

  // on create item, notify parent of new child
  itemService.hooks.setPostHook('create', async (member, repositories, { item }) => {
    const parentId = getParentFromPath(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('create', item));
    }
  });

  // on update item
  // - notify item itself of update
  // - notify parent of updated child
  itemService.hooks.setPostHook('update', async (item) => {
    websockets.publish(itemTopic, item.id, SelfItemEvent('update', item));

    const parentId = getParentFromPath(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('update', item));
    }
  });

  // on delete item
  // - notify item itself of deletion
  // - notify parent of deleted child
  itemService.hooks.setPostHook('delete', async (item) => {
    websockets.publish(itemTopic, item.id, SelfItemEvent('delete', item));

    const parentId = getParentFromPath(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('delete', item));
    }
  });

  // on copy item, notify destination parent of new child
  const copyItemTaskName = itemTaskManager.getCopyTaskName();
  runner.setTaskPostHookHandler<Item>(copyItemTaskName, async (item) => {
    const parentId = getParentFromPath(item.path);
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
    const parentId = getParentFromPath(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('delete', item));
    }
  });
  runner.setTaskPostHookHandler<Item>(moveItemTaskName, async (item) => {
    const parentId = getParentFromPath(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('create', item));
    }
  });
}

/**
 * helper to register items of member topic
 */
function registerMemberItemsTopic(websockets: WebsocketService, itemService: ItemService) {
  websockets.register(memberItemsTopic, async (req) => {
    const { channel: memberId, member, reject } = req;
    // requeted memberId channel must be current member
    if (memberId !== member.id) {
      reject(new Websocket.AccessDeniedError());
    }
  });

  // on create, notify own items of creator with new item IF path is root
  const createItemTaskName = itemTaskManager.getCreateTaskName();
  runner.setTaskPostHookHandler<Item>(createItemTaskName, async (item) => {
    const parentId = getParentFromPath(item.path);
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
    const parentId = getParentFromPath(item.path);
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
    const parentId = getParentFromPath(item.path);
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
    },
  );

  // on copy, notify own items of creator with new item IF destination is root
  const copyItemTaskName = itemTaskManager.getCopyTaskName();
  runner.setTaskPostHookHandler<Item>(copyItemTaskName, async (item) => {
    const parentId = getParentFromPath(item.path);
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
    const parentId = getParentFromPath(item.path);
    if (parentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator, OwnItemsEvent('delete', item));
    }
  });
  runner.setTaskPostHookHandler<Item>(moveItemTaskName, async (item) => {
    const parentId = getParentFromPath(item.path);
    if (parentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator, OwnItemsEvent('create', item));
    }
  });
}

/**
 * Registers real-time websocket events for the item service
 */
export const itemWsHooks: FastifyPluginAsync = (fastify) => {
  const { db } = fastify;
};
