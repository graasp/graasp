import Ajv, { JSONSchemaType, Schema } from 'ajv';
import fastJson from 'fast-json-stringify';

import { AppDataSource } from '../../../../../plugins/datasource';
import { ChatMessage } from '../../../../chat/chatMessage';
import { ChatMention } from '../../../../chat/plugins/mentions/chatMention';
import { ChatMessageRepository } from '../../../../chat/repository';
import { Item } from '../../../../item/entities/Item';
import { ItemFavorite } from '../../../../item/plugins/itemFavorite/entities/ItemFavorite';
import { Member } from '../../../entities/member';

export const expectNoLeaksAndEquality = <T extends object & { id: string }>(
  results: T[],
  expectations: T[],
  schema: Schema | JSONSchemaType<unknown>,
) => {
  expectNoLeakedColumns(results, schema);
  expectEquality(results, expectations, schema as object);
};

const expectNoLeakedColumns = <T>(results: T[], schema: Schema | JSONSchemaType<unknown>) => {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);

  results.forEach((res) => {
    if (!validate(res) && validate.errors) {
      expect(() => {
        throw new Error(
          `The results are not valid. Check the correct shape of the results!
          Additional props can lead to an unwanted leak ! If it is wanted, please update the wanted array.
          Validation errors: ${JSON.stringify(validate.errors)}.`,
        );
      }).not.toThrow();
    }
  });
};

const expectEquality = <T extends object & { id: string }>(
  results: T[],
  expectations: T[],
  schema: object,
) => {
  expect(results.length).toEqual(expectations.length);

  const stringify = fastJson(schema);
  results.forEach((res) => {
    const expectation = expectations.find((e) => e.id === res.id);
    expect(expectation).toBeDefined();
    expect(stringify(res)).toEqual(stringify(expectation));
  });
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
