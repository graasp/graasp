/**
 * Chat websocket events are registered under these topics
 */
import { ChatMention } from '../chatMention.js';

// chat mentions topic
export const chatMentionTopic = 'mentions';

/**
 * All websocket events for chat mentions will have this shape
 */
type ChatMentionEvent = {
  op: string;
  mention?: ChatMention;
};

/**
 * Events for chat mentions
 */
type MentionEvent = {
  op: 'publish' | 'delete' | 'update' | 'clear';
  mention?: ChatMention;
} & ChatMentionEvent;

/**
 * Factory for MentionsEvent
 * @param op operation of the event
 * @param mention message value
 * @returns instance of item chat event
 */

export const MentionEvent = (op: MentionEvent['op'], mention?: ChatMention): MentionEvent => ({
  op,
  mention,
});
