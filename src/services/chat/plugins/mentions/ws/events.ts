/**
 * Chat websocket events are registered under these topics
 */
import { ChatMentionRaw } from '../../../../../drizzle/types.js';

// chat mentions topic
export const chatMentionTopic = 'mentions';

/**
 * All websocket events for chat mentions will have this shape
 */
interface ChatMentionEvent {
  op: string;
  mention?: ChatMentionRaw;
}

/**
 * Events for chat mentions
 */
interface MentionEvent extends ChatMentionEvent {
  op: 'publish' | 'delete' | 'update' | 'clear';
  mention?: ChatMentionRaw;
}

/**
 * Factory for MentionsEvent
 * @param op operation of the event
 * @param mention message value
 * @returns instance of item chat event
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const MentionEvent = (op: MentionEvent['op'], mention?: ChatMentionRaw): MentionEvent => ({
  op,
  mention,
});
