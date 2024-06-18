/**
 * Chat websocket events are registered under these topics
 */
import { ChatMessage } from '../chatMessage.js';

// item chat messages
export const itemChatTopic = 'chat/item';

/**
 * All websocket events for chats will have this shape
 */
type ChatEvent = {
  kind: string;
  op: string;
  message?: ChatMessage;
};

/**
 * Events for item chats
 */
type ItemChatEvent = {
  kind: 'item';
  op: 'publish' | 'delete' | 'update' | 'clear';
  message?: ChatMessage;
} & ChatEvent;

/**
 * Factory for ItemChatEvent
 * @param op operation of the event
 * @param message message value
 * @returns instance of item chat event
 */

export const ItemChatEvent = (op: ItemChatEvent['op'], message?: ChatMessage): ItemChatEvent => ({
  kind: 'item',
  op,
  message,
});
