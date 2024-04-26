import { FastifyPluginAsync } from 'fastify';

import { Websocket, getParentFromPath } from '@graasp/sdk';

import { buildRepositories } from '../../../utils/repositories';
import { WebsocketService } from '../../websockets/ws-service';
import ItemService from '../service';
import {
  AccessibleItemsEvent,
  ChildItemEvent,
  OwnItemsEvent,
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
  itemService.hooks.setPostHook(
    'move',
    async (actor, repositories, { sourceParentId, source, destination }) => {
      if (sourceParentId !== undefined) {
        websockets.publish(itemTopic, sourceParentId, ChildItemEvent('delete', source));
      }

      const destParentId = getParentFromPath(destination.path);
      if (destParentId) {
        websockets.publish(itemTopic, destParentId, ChildItemEvent('create', destination));
      }
    },
  );
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

  // on move item:
  // - notify own items of creator of delete IF old location was root
  // - notify own items of creator of create IF new location is root
  itemService.hooks.setPostHook(
    'move',
    async (actor, repositories, { source, destination, sourceParentId }) => {
      if (sourceParentId === undefined && source.creator) {
        // root item, notify creator

        // todo: remove own when we don't use own anymore
        websockets.publish(memberItemsTopic, source.creator.id, OwnItemsEvent('delete', source));

        websockets.publish(
          memberItemsTopic,
          source.creator.id,
          AccessibleItemsEvent('delete', source),
        );
      }

      const destParentId = getParentFromPath(destination.path);
      if (destParentId === undefined && destination.creator) {
        // root item, notify creator
        // todo: remove own when we don't use own anymore
        websockets.publish(
          memberItemsTopic,
          destination.creator.id,
          OwnItemsEvent('create', destination),
        );
        websockets.publish(
          memberItemsTopic,
          destination.creator.id,
          AccessibleItemsEvent('create', destination),
        );
      }
    },
  );
}

/**
 * Registers real-time websocket events for the item service
 */
export const itemWsHooks: FastifyPluginAsync = async (fastify) => {
  const { websockets, items } = fastify;
  registerItemTopic(websockets, items.service);
  registerMemberItemsTopic(websockets, items.service);
};
