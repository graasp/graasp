import { FastifyPluginAsync } from 'fastify';

import { Websocket, getParentFromPath } from '@graasp/sdk';

import { buildRepositories } from '../../../utils/repositories';
import { WebsocketService } from '../../websockets/ws-service';
import ItemService from '../service';
import {
  AccessibleItemsEvent,
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
  itemService.hooks.setPostHook('create', async (member, repositories, { item }, log) => {
    try {
      const parentId = getParentFromPath(item.path);
      if (parentId !== undefined) {
        websockets.publish(itemTopic, parentId, ChildItemEvent('create', item));
      }
    } catch (e) {
      log?.error(e);
    }
  });

  // on update item
  // - notify item itself of update
  // - notify parent of updated child
  itemService.hooks.setPostHook('update', async (member, repositories, { item }, log) => {
    websockets.publish(itemTopic, item.id, SelfItemEvent('update', item));
    try {
      const parentId = getParentFromPath(item.path);
      if (parentId !== undefined) {
        websockets.publish(itemTopic, parentId, ChildItemEvent('update', item));
      }
    } catch (e) {
      log?.error(e);
    }
  });

  // on delete item
  // - notify item itself of deletion
  // - notify parent of deleted child
  itemService.hooks.setPostHook('delete', async (actor, repositories, { item }) => {
    websockets.publish(itemTopic, item.id, SelfItemEvent('delete', item));

    const parentId = getParentFromPath(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('delete', item));
    }
  });

  // on copy item, notify destination parent of new child
  itemService.hooks.setPostHook('copy', async (actor, repositories, { copy: item }) => {
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
    const { channel: memberId, member } = req;
    // requeted memberId channel must be current member
    if (memberId !== member.id) {
      throw new Websocket.AccessDeniedError();
    }
  });

  // on create, notify own items of creator with new item IF path is root
  itemService.hooks.setPostHook('create', async (actor, repositories, { item }, log) => {
    const parentId = getParentFromPath(item.path);
    try {
      if (parentId === undefined && item.creator) {
        // root item, notify creator
        websockets.publish(memberItemsTopic, item.creator.id, OwnItemsEvent('create', item));
        websockets.publish(memberItemsTopic, item.creator.id, AccessibleItemsEvent('create', item));
      }
    } catch (e) {
      log?.error(e);
    }
  });

  // on update
  // - notify own items of creator with updated item IF path is root
  // - notify members that have memberships on this item of update
  itemService.hooks.setPostHook('update', async (actor, repositories, { item }) => {
    const parentId = getParentFromPath(item.path);
    if (parentId === undefined && item.creator) {
      // root item, notify creator
      // todo: remove when we don't use own anymore
      websockets.publish(memberItemsTopic, item.creator.id, OwnItemsEvent('update', item));
      websockets.publish(memberItemsTopic, item.creator.id, AccessibleItemsEvent('update', item));
    }

    const { data: result } = await repositories.itemMembershipRepository.getForManyItems([item]);
    if (item.id in result) {
      const memberships = result[item.id];
      memberships.forEach(({ member }) => {
        if (member.id !== item.creator?.id) {
          /**
           * TODO: should this be only if item.path === topmost shared root for this member? There could
           * be an item higher in the tree which already has a (maybe lower) permission for this member
           * This is similar to {@link recycleWsHooks}
           * For now we can send anyway and ignore in the front-end if not already in shared root
           */
          // todo: remove when we don't use share anymore
          websockets.publish(memberItemsTopic, member.id, SharedItemsEvent('update', item));
          websockets.publish(memberItemsTopic, member.id, AccessibleItemsEvent('update', item));
        }
      });
    }
  });

  // on delete
  // - notify own items of creator of deleted item IF path is root
  // - notify members that have memberships on this item of delete
  //   (before with prehook, otherwise memberships lost on cascade from db!)
  itemService.hooks.setPreHook('delete', async (actor, repositories, { item }) => {
    const parentId = getParentFromPath(item.path);

    if (parentId === undefined && item.creator) {
      // root item, notify creator
      // todo: remove own when we don't use own anymore
      websockets.publish(memberItemsTopic, item.creator.id, OwnItemsEvent('delete', item));
      websockets.publish(memberItemsTopic, item.creator.id, AccessibleItemsEvent('delete', item));
    }

    const { data: result } = await repositories.itemMembershipRepository.getForManyItems([item]);
    if (item.id in result) {
      const memberships = result[item.id];
      memberships.forEach(({ member }) => {
        if (member.id !== item.creator?.id) {
          /**
           * TODO: should this be only if item.path === topmost shared root for this member? There could
           * be an item higher in the tree which already has a (maybe lower) permission for this member
           * This is similar to {@link recycleWsHooks}
           * For now we can send anyway and ignore in the front-end if not already in shared root
           */
          // todo: remove when we don't use share anymore
          websockets.publish(memberItemsTopic, member.id, SharedItemsEvent('delete', item));
          websockets.publish(memberItemsTopic, member.id, AccessibleItemsEvent('delete', item));
        }
      });
    }
  });

  // on copy, notify own items of creator with new item IF destination is root
  itemService.hooks.setPostHook('copy', async (actor, repositories, { copy: item }) => {
    const parentId = getParentFromPath(item.path);
    if (parentId === undefined && item.creator) {
      // root item, notify creator
      // todo: remove own when we don't use own anymore
      websockets.publish(memberItemsTopic, item.creator.id, OwnItemsEvent('create', item));
      websockets.publish(memberItemsTopic, item.creator.id, AccessibleItemsEvent('create', item));
    }
  });
}

/**
 * Registers real-time websocket events for the item service
 */
export const itemWsHooks: FastifyPluginAsync = async (fastify) => {
  const { websockets, items } = fastify;
  registerItemTopic(websockets, items.service);
  registerMemberItemsTopic(websockets, items.service);
};
