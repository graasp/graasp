/**
 * Chat websocket events are registered under these topics
 */
import { ChatMessage } from '../chatMessage';

// item chat messages
export const itemChatTopic = 'chat/item';

/**
 * All websocket events for chats will have this shape
 */
interface ChatEvent {
  kind: string;
  op: string;
  message?: ChatMessage;
}

/**
 * Events for item chats
 */
interface ItemChatEvent extends ChatEvent {
  kind: 'item';
  op: 'publish' | 'delete' | 'update' | 'clear';
  message?: ChatMessage;
}

/**
 * Factory for ItemChatEvent
 * @param op operation of the event
 * @param message message value
 * @returns instance of item chat event
 */
export const ItemChatEvent = (
  op: ItemChatEvent['op'],
  message?: ChatMessage,
): // eslint-disable-next-line @typescript-eslint/no-unused-vars
ItemChatEvent => ({
  kind: 'item',
  op,
  message,
});
