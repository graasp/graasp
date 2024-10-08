import { AppDataSource } from '../../../plugins/datasource';
import { Item } from '../../item/entities/Item';
import { Member } from '../../member/entities/member';
import { ChatMessage } from '../chatMessage';
import { ChatMention } from '../plugins/mentions/chatMention';

export const saveChatMessages = async ({
  creator,
  item,
  mentionMember,
}: {
  creator: Member;
  item: Item;
  mentionMember?: Member;
}) => {
  const chatMentionRepo = AppDataSource.getRepository(ChatMention);
  const rawChatMessageRepository = AppDataSource.getRepository(ChatMessage);
  const chatMessages: ChatMessage[] = [];
  const chatMentions: ChatMention[] = [];
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
