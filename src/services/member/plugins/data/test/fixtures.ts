import { AppDataSource } from '../../../../../plugins/datasource';
import { ChatMessage } from '../../../../chat/chatMessage';
import { ChatMention } from '../../../../chat/plugins/mentions/chatMention';
import { ChatMessageRepository } from '../../../../chat/repository';
import { Item } from '../../../../item/entities/Item';
import { ItemFavorite } from '../../../../item/plugins/itemFavorite/entities/ItemFavorite';
import { Member } from '../../../entities/member';

/**
 * Check that only the wanted props are present and the value are as expected.
 * Wanted and unwanted props must be mutual exlusive.
 *
 * @param results: The objects to validate.
 * @param expectactions: The objects to use for validation.
 * @param wantedProps: The valid props to compare between the results and expectations.
 * @param unwantedProps: The unvalid props that results should not have.
 * @param mustContainsAllProps: If true, all the props must be dispatched in wanted or unwanted.
 */
export const expectObjects = <T extends { id: string }, K extends keyof T = keyof T>({
  results,
  expectations,
  wantedProps,
  typeName = 'object',
  verbose = false,
}: {
  results: T[];
  expectations: T[];
  wantedProps: K[];
  typeName?: string;
  verbose?: boolean;
}) => {
  console.log(`Testing ${typeName}.`);
  expect(results).toHaveLength(expectations.length);

  const allProps = Object.keys(results[0]);

  for (const expected of expectations) {
    const result = results.find((a) => a.id === expected.id);
    if (!result) {
      throw new Error(`${typeName} should exist`);
    }

    const missingWantedProps = allProps.filter((e) => !wantedProps.includes(e as K));

    if (missingWantedProps.length) {
      expect(() => {
        throw new Error(
          `The props "${missingWantedProps.join(
            ', ',
          )}" are in the results but not in the wanted props.
         This can lead to an unwanted leak ! If it is wanted, please update the wanted array.`,
        );
      }).not.toThrow();
    }

    wantedProps.forEach((prop) => {
      if (verbose) {
        console.log(
          `Expecting "${expected[prop]}" for "${result[prop]}" where key is "${String(prop)}".`,
        );
      }
      expect(result[prop]).toEqual(expected[prop]);
    });
  }
};

/**
 * Checks that the exported resource doesn't contain an unanonymized member ID of another member.
 *
 * @param resource The exported resource.
 * @param exportActorId The ID of the member who exported the resource.
 * @param memberId The ID of the member ID who must be anonymized.
 * @param memberIdKey The prop name of the member ID of the given resource.
 */
export const expectNotLeakMemberId = <T>({
  resource,
  exportActorId,
  memberId,
}: {
  resource: T;
  exportActorId: string;
  memberId?: string;
}) => {
  const lowerMemberId = memberId?.toLocaleLowerCase();
  const lowerActorId = exportActorId.toLocaleLowerCase();
  // If there is a member ID who is not the exported actor,
  // check that the id is anonymized.
  if (lowerMemberId && lowerMemberId !== lowerActorId) {
    const stringified = JSON.stringify(resource).toLocaleLowerCase();
    if (stringified.includes(lowerMemberId)) {
      expect(() => {
        throw new Error(`The member ID ${memberId} is leaked !`);
      }).not.toThrow();
    }
  }
};

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

export const saveItemFavorites = async ({ items, member }: { items: Item[]; member: Member }) => {
  const repository = AppDataSource.getRepository(ItemFavorite);
  const favorites: ItemFavorite[] = [];

  for (const item of items) {
    const favorite = await repository.save({ item, member });
    favorites.push(favorite);
  }

  return favorites;
};
