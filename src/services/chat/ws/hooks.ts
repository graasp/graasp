import { PermissionLevel } from '@graasp/sdk';

import { type DBConnection } from '../../../drizzle/db';
import { ChatMessageRaw, ChatMessageWithCreator } from '../../../drizzle/types';
import { ItemService } from '../../item/item.service';
import { WebsocketService } from '../../websockets/ws-service';
import { ChatMessageService } from '../chatMessage.service';
import { ItemChatEvent, itemChatTopic } from './events';

export function registerChatWsHooks(
  dbConnection: DBConnection,
  websockets: WebsocketService,
  chatService: ChatMessageService,
  itemService: ItemService,
) {
  websockets.register(itemChatTopic, async (req) => {
    const { channel: itemId, member } = req;
    // item must exist with read permission, else exception is thrown
    await itemService.basicItemService.get(dbConnection, member, itemId, PermissionLevel.Read);
  });

  // on new chat message published, broadcast to item chat channel
  chatService.hooks.setPostHook(
    'publish',
    async (member, dbConnection, { message }: { message: ChatMessageWithCreator }) => {
      websockets.publish(itemChatTopic, message.itemId, ItemChatEvent('publish', message));
    },
  );

  // on update chat item, broadcast to item chat channel
  chatService.hooks.setPostHook(
    'update',
    async (member, dbConnection, { message }: { message: ChatMessageWithCreator }) => {
      websockets.publish(itemChatTopic, message.itemId, ItemChatEvent('update', message));
    },
  );

  // on delete chat item, broadcast to item chat channel
  chatService.hooks.setPostHook(
    'delete',
    async (member, dbConnection, { message }: { message: ChatMessageRaw }) => {
      websockets.publish(itemChatTopic, message.itemId, ItemChatEvent('delete', message));
    },
  );

  // on clear chat, broadcast to item chat channel
  chatService.hooks.setPostHook(
    'clear',
    async (member, dbConnection, { itemId }: { itemId: string }) => {
      websockets.publish(itemChatTopic, itemId, ItemChatEvent('clear'));
    },
  );
}
