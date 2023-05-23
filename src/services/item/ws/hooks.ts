import { FastifyPluginAsync } from 'fastify';

import { Websocket, getParentFromPath } from '@graasp/sdk';

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
  itemService.hooks.setPostHook('update', async (member, repositories, { item }) => {
    websockets.publish(itemTopic, item.id, SelfItemEvent('update', item));

    const parentId = getParentFromPath(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('update', item));
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

  // on move item, notify:
  // - parent of old location of deleted child
  // - parent of new location of new child
  itemService.hooks.setPostHook('move', async (actor, repositories, { source, destination }) => {
    const sourceParentId = getParentFromPath(source.path);
    if (sourceParentId !== undefined) {
      websockets.publish(itemTopic, sourceParentId, ChildItemEvent('delete', source));
    }

    const destParentId = getParentFromPath(destination.path);
    if (destParentId !== undefined) {
      websockets.publish(itemTopic, destParentId, ChildItemEvent('create', destination));
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
  itemService.hooks.setPostHook('create', async (actor, repositories, { item }) => {
    const parentId = getParentFromPath(item.path);
    if (parentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator.id, OwnItemsEvent('create', item));
    }
  });

  // on update
  // - notify own items of creator with updated item IF path is root
  // - notify members that have memberships on this item of update
  itemService.hooks.setPostHook('update', async (actor, repositories, { item }) => {
    const parentId = getParentFromPath(item.path);
    if (parentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator.id, OwnItemsEvent('update', item));
    }

    const { data: result } = await repositories.itemMembershipRepository.getForManyItems([item]);
    if (item.id in result) {
      const memberships = result[item.id];
      memberships.forEach(({ member }) => {
        if (member.id !== item.creator.id) {
          websockets.publish(memberItemsTopic, member.id, SharedItemsEvent('update', item));
        }
      });
    }
  });

  // on delete
  // - notify own items of creator of deleted item IF path is root
  // - notify members that have memberships on this item of delete
  //   (before with prehook, otherwise memberships lost on cascade from db!)
  itemService.hooks.setPostHook('delete', async (actor, repositories, { item }) => {
    const parentId = getParentFromPath(item.path);
    if (parentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator.id, OwnItemsEvent('delete', item));
    }

    const { data: result } = await repositories.itemMembershipRepository.getForManyItems([item]);
    if (item.id in result) {
      const memberships = result[item.id];
      memberships.forEach(({ member }) => {
        if (member.id !== item.creator.id) {
          websockets.publish(memberItemsTopic, member.id, SharedItemsEvent('delete', item));
        }
      });
    }
  });

  // on copy, notify own items of creator with new item IF destination is root
  itemService.hooks.setPostHook('copy', async (actor, repositories, { copy: item }) => {
    const parentId = getParentFromPath(item.path);
    if (parentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator.id, OwnItemsEvent('create', item));
    }
  });

  // on move item:
  // - notify own items of creator of delete IF old location was root
  // - notify own items of creator of create IF new location is root
  itemService.hooks.setPostHook('move', async (actor, repositories, { source, destination }) => {
    const sourceParentId = getParentFromPath(source.path);
    if (sourceParentId === undefined) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, source.creator.id, OwnItemsEvent('delete', source));
    }

    const destParentId = getParentFromPath(destination.path);
    if (destParentId === undefined) {
      // root item, notify creator
      websockets.publish(
        memberItemsTopic,
        destination.creator.id,
        OwnItemsEvent('create', destination),
      );
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
