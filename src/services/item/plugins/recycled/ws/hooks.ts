import { FastifyPluginAsync } from 'fastify';

import { PermissionLevel, getParentFromPath } from '@graasp/sdk';

import { WebsocketService } from '../../../../websockets/ws-service';
import {
  ChildItemEvent,
  OwnItemsEvent,
  SelfItemEvent,
  SharedItemsEvent,
  itemTopic,
  memberItemsTopic,
} from '../../../ws/events';
import { RecycledBinService } from '../service';
import { RecycleBinEvent } from './events';

function registerRecycleWsHooks(
  websockets: WebsocketService,
  recycleBinService: RecycledBinService,
) {
  // on recycle of an item, this is executed on each node in the recycled tree of this item
  // on each visited node:
  // - notify item node itself of (soft) deletion
  // - notify parent node of (soft) deleted child
  // - notify own items of creator of (soft) deleted item IF absolute path of node is root
  // - notify shared items of members that have memberships on this item node of (soft) delete
  // - notify recycle bin of admins of new recycled item IF recycled path of node is root
  recycleBinService.hooks.setPostHook(
    'recycle',
    async (member, repositories, { item, isRecycledRoot }) => {
      websockets.publish(itemTopic, item.id, SelfItemEvent('delete', item));

      const parentId = getParentFromPath(item.path);
      if (parentId !== undefined) {
        websockets.publish(itemTopic, parentId, ChildItemEvent('delete', item));
      } else if (item.creator?.id) {
        // root item, notify creator
        websockets.publish(memberItemsTopic, item.creator.id, OwnItemsEvent('delete', item));
      }

      // item is already soft-deleted so we need withDeleted=true
      const { data: itemIdsToMemberships } =
        await repositories.itemMembershipRepository.getForManyItems([item], { withDeleted: true });
      const memberships = itemIdsToMemberships[item.id];

      if (memberships) {
        memberships.forEach(({ member, permission }) => {
          // remove from shared items of all members that have a memberships on this node
          if (member.id !== item.creator?.id) {
            websockets.publish(memberItemsTopic, member.id, SharedItemsEvent('delete', item));
          }

          // send recycled root to recycle bin of all admins of item
          if (isRecycledRoot && permission === PermissionLevel.Admin) {
            websockets.publish(memberItemsTopic, member.id, RecycleBinEvent('create', item));
          }
        });
      }
    },
  );

  // on restore item
  // - notify parent of (re)created child
  // - notify own items of creator of (re)created item IF path is root
  // - notify recycled items of TODO:creator?admins?memberships? of restored item IF path is root
  // - notify members that have memberships on this item of (re)created item TODO: in an inherited case, only the top-level for the given membership should emit an event. Same for delete operation in item hooks
  recycleBinService.hooks.setPostHook(
    'restore',
    async (member, repositories, { item, isRestoredRoot }) => {
      const parentId = getParentFromPath(item.path);
      if (parentId !== undefined) {
        websockets.publish(itemTopic, parentId, ChildItemEvent('create', item));
      } else if (item.creator?.id) {
        // root item, notify creator
        websockets.publish(memberItemsTopic, item.creator.id, OwnItemsEvent('create', item));

        // TODO: should send to item.creator.id? members that have memberhsip? admins only?
        websockets.publish(memberItemsTopic, item.creator.id, RecycleBinEvent('delete', item));
      }

      // TODO: in an inherited case, only the top-level for the given membership should emit an event. Same for update operation in item hooks
      const { data: itemIdsToMemberships } =
        await repositories.itemMembershipRepository.getForManyItems([item]);
      if (item.id in itemIdsToMemberships) {
        const memberships = itemIdsToMemberships[item.id];
        memberships.forEach(({ member }) => {
          if (member.id !== item.creator?.id) {
            websockets.publish(memberItemsTopic, member.id, SharedItemsEvent('create', item));
          }
        });
      }
    },
  );
}

export const recycleWsHooks: FastifyPluginAsync<{ recycleService: RecycledBinService }> = async (
  fastify,
  options,
) => {
  const { websockets } = fastify;
  const { recycleService } = options;
  registerRecycleWsHooks(websockets, recycleService);
};
