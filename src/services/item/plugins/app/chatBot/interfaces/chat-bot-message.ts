export interface ChatBotMessage {
  role: 'system' | 'assistant' | 'user';
  content: string;
}
