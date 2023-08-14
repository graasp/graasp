import { getParentFromPath } from '@graasp/sdk';

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

export function registerRecycleWsHooks(
  websockets: WebsocketService,
  recycleBinService: RecycledBinService,
) {
  // on recycle item
  // - notify item itself of (soft) deletion
  // - notify parent of (soft) deleted child
  // - notify own items of creator of (soft) deleted item IF path is root
  // - notify recycled items of TODO:creator?admins?memberships? of new recycled item IF path is root
  // - notify members that have memberships on this item of (soft) delete
  recycleBinService.hooks.setPostHook('recycle', async (member, repositories, { item }) => {
    websockets.publish(itemTopic, item.id, SelfItemEvent('delete', item));

    const parentId = getParentFromPath(item.path);
    if (parentId !== undefined) {
      websockets.publish(itemTopic, parentId, ChildItemEvent('delete', item));
    } else if (item.creator?.id) {
      // root item, notify creator
      websockets.publish(memberItemsTopic, item.creator.id, OwnItemsEvent('delete', item));

      // TODO: should send to item.creator.id? members that have membership? admins only?
      websockets.publish(memberItemsTopic, item.creator.id, RecycleBinEvent('create', item));
    }

    // TODO: in an inherited case, only the top-level for the given membership should emit an event. Same for delete operation in item hooks
    const { data: itemIdsToMemberships } =
      await repositories.itemMembershipRepository.getForManyItems([item]);
    if (item.id in itemIdsToMemberships) {
      const memberships = itemIdsToMemberships[item.id];
      memberships.forEach(({ member }) => {
        if (member.id !== item.creator?.id) {
          websockets.publish(memberItemsTopic, member.id, SharedItemsEvent('delete', item));
        }
      });
    }
  });

  // on restore item
  // - notify parent of (re)created child
  // - notify own items of creator of (re)created item IF path is root
  // - notify recycled items of TODO:creator?admins?memberships? of restored item IF path is root
  // - notify members that have memberships on this item of (re)created item TODO: in an inherited case, only the top-level for the given membership should emit an event. Same for delete operation in item hooks
  recycleBinService.hooks.setPostHook('restore', async (member, repositories, { item }) => {
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
  });
}
