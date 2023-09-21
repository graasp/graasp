import { FastifyPluginAsync } from 'fastify';

import { PermissionLevel, getParentFromPath } from '@graasp/sdk';

import { ItemMembership } from '../../../../itemMembership/entities/ItemMembership';
import { Member } from '../../../../member/entities/member';
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
        // keep only topmost membership in the tree for each member
        const memberToTopmost = new Map<Member['id'], ItemMembership>();
        memberships.forEach((membership) => {
          const current = memberToTopmost.get(membership.member.id);
          if (!current || membership.item.path.length < current.item.path.length) {
            memberToTopmost.set(membership.member.id, membership);
          }

          // send recycled root to recycle bin of all admins of item
          // note that it is not necessarily the topmost! an ancestor node may have weaker permission
          // so we have to perform the check over all permissions of the recycled root
          if (isRecycledRoot && membership.permission === PermissionLevel.Admin) {
            websockets.publish(
              memberItemsTopic,
              membership.member.id,
              RecycleBinEvent('create', item),
            );
          }
        });

        memberToTopmost.forEach(({ member, item: topmost }) => {
          // remove from shared items of all members that have a membership on this node, only if this is the topmost shared root for this member
          if (member.id !== item.creator?.id && item.path === topmost.path) {
            websockets.publish(memberItemsTopic, member.id, SharedItemsEvent('delete', item));
          }
        });
      }
    },
  );

  // on restore of an item, this is executed on each node in the recycled tree of this item
  // on each visited node:
  // - notify parent node of (re)created child IF recycled path of node is root
  // - notify own items of creator of (re)created item IF absolute path of node is root
  // - notify shared items of members that have memberships on this item node of (re)created item
  // - notify recycle bin of admins of restored (= removed recycled item) IF recycled path of node is root
  recycleBinService.hooks.setPostHook(
    'restore',
    async (member, repositories, { item, isRestoredRoot }) => {
      const parentId = getParentFromPath(item.path);
      if (parentId !== undefined) {
        if (isRestoredRoot) {
          websockets.publish(itemTopic, parentId, ChildItemEvent('create', item));
        }
      } else if (item.creator?.id) {
        // root item, notify creator
        websockets.publish(memberItemsTopic, item.creator.id, OwnItemsEvent('create', item));
      }

      const { data: itemIdsToMemberships } =
        await repositories.itemMembershipRepository.getForManyItems([item]);
      const memberships = itemIdsToMemberships[item.id];

      if (memberships) {
        // keep only topmost membership in the tree for each member
        const memberToTopmost = new Map<Member['id'], ItemMembership>();
        memberships.forEach((membership) => {
          const current = memberToTopmost.get(membership.member.id);
          if (!current || membership.item.path.length < current.item.path.length) {
            memberToTopmost.set(membership.member.id, membership);
          }

          // remove recycled root from recycle bin of all admins of item
          // note that it is not necessarily the topmost! an ancestor node may have weaker permission
          // so we have to perform the check over all permissions of the recycled root
          if (isRestoredRoot && membership.permission === PermissionLevel.Admin) {
            websockets.publish(
              memberItemsTopic,
              membership.member.id,
              RecycleBinEvent('delete', item),
            );
          }
        });

        memberToTopmost.forEach(({ member, item: topmost }) => {
          // re-add to shared items of all members that have a membership on this node, only if this is the topmost shared root for this member
          if (member.id !== item.creator?.id && item.path === topmost.path) {
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
