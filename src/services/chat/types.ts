export type MessageBodyType = {
  message: string;
  mentions?: string[];
};

/**
 * Shape of a new chat message
 */
export interface PartialNewChatMessage {
  creator: string;
  chatId: string;
  body: MessageBodyType;
}
/**
 * Shape of an updated chat message
 */
export interface PartialChatMessage {
  id: string;
  chatId: string;
  body: MessageBodyType;
}

/**
 * Shape of chat messages
 */
export interface ChatMessage {
  id: string;
  chatId: string;
  creator: string;
  createdAt: string;
  updatedAt: string;
  body: string;
}
