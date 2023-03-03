// import {
//   Actor,
//   DatabaseTransactionHandler,
//   Item,
//   ItemMembershipService,
//   ItemTaskManager,
//   MemberService,
//   TaskRunner,
// } from '@graasp/sdk';
// import { AccessDenied, NotFound, WebSocketService } from 'graasp-websockets';

// import { ChatMessage } from '../../chat/interfaces/chat-message';
// import { ChatTaskManager } from '../../chat/interfaces/chat-task-manager';
// import { ChatMention, MemberChatMentions } from '../interfaces/chat-mention';
// import { ChatMentionsTaskManager } from '../interfaces/chat-mentions-task-manager';
// import { MentionService } from '../repository';
// import { MentionEvent, chatMentionTopic } from './events';

// export function registerChatMentionsWsHooks(
//   websockets: WebSocketService,
//   runner: TaskRunner<Actor>,
//   mentionService: MentionService,
//   memberService: MemberService,
//   itemMembershipService: ItemMembershipService,
//   itemTaskManager: ItemTaskManager,
//   chatTaskManager: ChatTaskManager,
//   chatMentionsTaskManager: ChatMentionsTaskManager,
//   validationDbHandler: DatabaseTransactionHandler,
// ) {
//   websockets.register(chatMentionTopic, async (req) => {
//     const { channel: memberId, member, reject } = req;
//     // member must exist
//     const memberFromDb = await memberService.get(memberId, validationDbHandler);
//     if (!memberFromDb) {
//       reject(NotFound());
//     }
//     // member must request his own channel
//     if (memberId !== member.id) {
//       reject(AccessDenied());
//     }
//   });

//   // on new chat message published, broadcast the mentions to their channels
//   const createMentionsTaskName = chatMentionsTaskManager.getCreateMentionsTaskName();
//   runner.setTaskPostHookHandler<ChatMention[]>(createMentionsTaskName, (mentions) => {
//     // publish each mentions to its respective channel
//     mentions.map((mention) =>
//       websockets.publish(chatMentionTopic, mention.memberId, MentionEvent('publish', mention)),
//     );
//   });

//   // on update mention, broadcast to member mention channel
//   const updateMentionStatusTaskName = chatMentionsTaskManager.getUpdateMentionStatusTaskName();
//   runner.setTaskPostHookHandler<ChatMention>(updateMentionStatusTaskName, (mention) => {
//     websockets.publish(chatMentionTopic, mention.memberId, MentionEvent('update', mention));
//   });

//   // on delete chat mention, broadcast to member mention channel
//   const deleteMentionTaskName = chatMentionsTaskManager.getDeleteMentionTaskName();
//   runner.setTaskPostHookHandler<ChatMention>(deleteMentionTaskName, (mention) => {
//     websockets.publish(chatMentionTopic, mention.memberId, MentionEvent('delete', mention));
//   });

//   // on clear chat, broadcast to item chat channel
//   const clearAllMentionsTaskName = chatMentionsTaskManager.getClearAllMentionsTaskName();
//   runner.setTaskPostHookHandler<MemberChatMentions>(clearAllMentionsTaskName, ({ memberId }) => {
//     websockets.publish(chatMentionTopic, memberId, MentionEvent('clear'));
//   });

//   // on item delete -> pre-hook should remove the mentions from the channel
//   const deleteItemTaskName = itemTaskManager.getDeleteTaskName();
//   runner.setTaskPreHookHandler<Item>(deleteItemTaskName, async (item) => {
//     // get mentions to be deleted
//     const mentions = await mentionService.getMentionsByItemPath(item.path, validationDbHandler);
//     mentions.map((m) =>
//       websockets.publish(chatMentionTopic, m.memberId, MentionEvent('delete', m)),
//     );
//   });

//   // on message delete -> pre-hook should remove the mentions from the channel
//   const deleteChatMessageTaskName = chatTaskManager.getDeleteMessageTaskName();
//   runner.setTaskPreHookHandler<ChatMessage>(deleteChatMessageTaskName, async (message) => {
//     const mentions = await mentionService.getMentionsByMessageId(message.id, validationDbHandler);
//     mentions.map((m) =>
//       websockets.publish(chatMentionTopic, m.memberId, MentionEvent('delete', m)),
//     );
//   });
// }
