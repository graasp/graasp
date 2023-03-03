// import {
//   Actor,
//   DatabaseTransactionHandler,
//   ItemMembershipService,
//   ItemService,
//   TaskRunner,
// } from '@graasp/sdk';
// import { AccessDenied, NotFound, WebSocketService } from 'graasp-websockets';

// import { Chat } from '../interfaces/chat';
// import { ChatMessage } from '../interfaces/chat-message';
// import { ChatTaskManager } from '../interfaces/chat-task-manager';
// import { ItemChatEvent, itemChatTopic } from './events';

// export function registerChatWsHooks(
//   websockets: WebSocketService,
//   runner: TaskRunner<Actor>,
//   itemService: ItemService,
//   itemMembershipService: ItemMembershipService,
//   chatTaskManager: ChatTaskManager,
//   validationDbHandler: DatabaseTransactionHandler,
// ) {
//   websockets.register(itemChatTopic, async (req) => {
//     const { channel: itemId, member, reject } = req;
//     // item must exist
//     const item = await itemService.get(itemId, validationDbHandler);
//     if (!item) {
//       reject(NotFound());
//     }
//     // member must have at least read access to item
//     const allowed = await itemMembershipService.canRead(member.id, item, validationDbHandler);
//     if (!allowed) {
//       reject(AccessDenied());
//     }
//   });

//   // on new chat message published, broadcast to item chat channel
//   const publishMessageTaskName = chatTaskManager.getPublishMessageTaskName();
//   runner.setTaskPostHookHandler<ChatMessage>(publishMessageTaskName, (message) => {
//     websockets.publish(itemChatTopic, message.chatId, ItemChatEvent('publish', message));
//   });

//   // on update chat item, broadcast to item chat channel
//   const patchMessageTaskName = chatTaskManager.getPatchMessageTaskName();
//   runner.setTaskPostHookHandler<ChatMessage>(patchMessageTaskName, (message) => {
//     websockets.publish(itemChatTopic, message.chatId, ItemChatEvent('update', message));
//   });

//   // on delete chat item, broadcast to item chat channel
//   const deleteMessageTaskName = chatTaskManager.getDeleteMessageTaskName();
//   runner.setTaskPostHookHandler<ChatMessage>(deleteMessageTaskName, (message) => {
//     websockets.publish(itemChatTopic, message.chatId, ItemChatEvent('delete', message));
//   });

//   // on clear chat, broadcast to item chat channel
//   const clearChatTaskName = chatTaskManager.getClearChatTaskName();
//   runner.setTaskPostHookHandler<Chat>(clearChatTaskName, (chat) => {
//     websockets.publish(itemChatTopic, chat.id, ItemChatEvent('clear'));
//   });
// }
