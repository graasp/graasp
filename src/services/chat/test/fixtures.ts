import { ChatMentionRaw, ChatMessageRaw, Item } from '../../../drizzle/types.js';
import { MinimalMember } from '../../../types.js';

export const saveChatMessages = async ({
  creator,
  item,
  mentionMember,
}: {
  creator: MinimalMember;
  item: Item;
  mentionMember?: MinimalMember;
}) => {
  const chatMentionRepo = AppDataSource.getRepository(ChatMention);
  const rawChatMessageRepository = AppDataSource.getRepository(ChatMessage);
  const chatMessages: ChatMessageRaw[] = [];
  const chatMentions: ChatMentionRaw[] = [];
  // mock the mention format of react-mention used in the chat-box
  const mentionMessage = mentionMember ? `<!@${mentionMember.id}>[${mentionMember.name}]` : null;

  for (let i = 0; i < 3; i++) {
    const body = `${mentionMessage} some-text-${i} <!@${creator.id}>[${creator.name}]`;
    const message = await rawChatMessageRepository.save({ item, creator, body });
    chatMessages.push(message);
    chatMentions.push(await chatMentionRepo.save({ account: mentionMember, message }));
  }
  return { chatMessages, chatMentions, mentionedMember: mentionMember };
};
