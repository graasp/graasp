import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../utils/repositories';
import ItemService from '../../item/service';
import { WebsocketService } from '../../websockets/ws-service';
import { ChatMessageService } from '../service';
import { ItemChatEvent, itemChatTopic } from './events';

export function registerChatWsHooks(
  repositories: Repositories,
  websockets: WebsocketService,
  chatService: ChatMessageService,
  itemService: ItemService,
) {
  websockets.register(itemChatTopic, async (req) => {
    const { channel: itemId, member } = req;
    // item must exist with read permission, else exception is thrown
    await itemService.get(member, repositories, itemId, PermissionLevel.Read);
  });

  // on new chat message published, broadcast to item chat channel
  chatService.hooks.setPostHook('publish', async (member, repositories, { message }) => {
    websockets.publish(itemChatTopic, message.item.id, ItemChatEvent('publish', message));
  });

  // on update chat item, broadcast to item chat channel
  chatService.hooks.setPostHook('update', async (member, repositories, { message }) => {
    websockets.publish(itemChatTopic, message.item.id, ItemChatEvent('update', message));
  });

  // on delete chat item, broadcast to item chat channel
  chatService.hooks.setPostHook('delete', async (member, repositories, { message }) => {
    websockets.publish(itemChatTopic, message.item.id, ItemChatEvent('delete', message));
  });

  // on clear chat, broadcast to item chat channel
  chatService.hooks.setPostHook('clear', async (member, repositories, { itemId }) => {
    websockets.publish(itemChatTopic, itemId, ItemChatEvent('clear'));
  });
}
