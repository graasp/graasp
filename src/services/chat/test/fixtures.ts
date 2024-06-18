import { AppDataSource } from '../../../plugins/datasource.js';
import { Item } from '../../item/entities/Item.js';
import { Member } from '../../member/entities/member.js';
import { ChatMessage } from '../chatMessage.js';
import { ChatMention } from '../plugins/mentions/chatMention.js';
import { ChatMessageRepository } from '../repository.js';

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
  const chatMessages: ChatMessage[] = [];
  const chatMentions: ChatMention[] = [];
  // mock the mention format of react-mention used in the chat-box
  const mentionMessage = mentionMember ? `<!@${mentionMember.id}>[${mentionMember.name}]` : null;

  for (let i = 0; i < 3; i++) {
    const body = `${mentionMessage} some-text-${i} <!@${creator.id}>[${creator.name}]`;
    const message = await ChatMessageRepository.save({ item, creator, body });
    chatMessages.push(message);
    chatMentions.push(await chatMentionRepo.save({ member: mentionMember, message }));
  }
  return { chatMessages, chatMentions, mentionedMember: mentionMember };
};
