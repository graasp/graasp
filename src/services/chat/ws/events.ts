/**
 * Chat websocket events are registered under these topics
 */
import { ChatMessageRaw } from '../../../drizzle/types';

// item chat messages
export const itemChatTopic = 'chat/item';

/**
 * All websocket events for chats will have this shape
 */
interface ChatEvent {
  kind: string;
  op: string;
  message?: ChatMessageRaw;
}

/**
 * Events for item chats
 */
interface ItemChatEvent extends ChatEvent {
  kind: 'item';
  op: 'publish' | 'delete' | 'update' | 'clear';
  message?: ChatMessageRaw;
}

/**
 * Factory for ItemChatEvent
 * @param op operation of the event
 * @param message message value
 * @returns instance of item chat event
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const ItemChatEvent = (
  op: ItemChatEvent['op'],
  message?: ChatMessageRaw,
): // eslint-disable-next-line @typescript-eslint/no-unused-vars
ItemChatEvent => ({
  kind: 'item',
  op,
  message,
});
