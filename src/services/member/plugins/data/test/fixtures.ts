import { AppDataSource } from '../../../../../plugins/datasource';
import { ChatMessage } from '../../../../chat/chatMessage';
import { ChatMention } from '../../../../chat/plugins/mentions/chatMention';
import { ChatMessageRepository } from '../../../../chat/repository';
import { Item } from '../../../../item/entities/Item';
import { ItemFavorite } from '../../../../item/plugins/itemFavorite/entities/ItemFavorite';
import { Member } from '../../../entities/member';

// TODO: maybe move it to SDK ?
// Nested more than 1 deep is not working yet because of circular dep.
// That means doing message.member.name is not working yet. Use Any the time to solve that.
// https://stackoverflow.com/questions/71934070/how-do-i-get-a-deep-keyof-with-dot-access-paths-that-allow-circular-referencing
type StringOrNumKeys<T> = keyof T & (string | number);
type OneLevelNestedKeyOf<T> =
  // | any
  | {
      [Key in StringOrNumKeys<T>]: NonNullable<T[Key]> extends object
        ? `${Key}` | `${Key}.${StringOrNumKeys<NonNullable<T[Key]>>}`
        : `${Key}`;
    }[StringOrNumKeys<T>];

const getKeysAndFirstNestedKeys = <T extends object>(obj: T) => {
  const keys: string[] = [];
  for (const key in obj) {
    keys.push(key);
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const nestedObject = obj[key] as object;
      const nestedKeys = Object.keys(nestedObject) as (string | number)[];
      keys.push(...nestedKeys.map((nestedKey) => `${key}.${nestedKey}`));
    }
  }
  return keys;
};

const computeFirstNestedKeys = <T extends object>(
  result: T,
  wantedProps: OneLevelNestedKeyOf<T>[],
) => {
  // include parent prop of nested props
  const wantedSet = new Set<string>();
  for (const key of wantedProps) {
    const stringKey = String(key);
    const nestedKeys = result[stringKey];

    if (nestedKeys && typeof nestedKeys === 'object') {
      Object.keys(nestedKeys)
        .map((k) => `${stringKey}.${k}`)
        .forEach(wantedSet.add, wantedSet);
    }

    wantedSet.add(stringKey);
    if (stringKey.includes('.')) {
      wantedSet.add(stringKey.split('.')[0]);
    }
  }
  return wantedSet;
};

const expectNoLeakedColumn = <T extends object>(
  result: T,
  allProps: string[],
  wantedProps: OneLevelNestedKeyOf<T>[],
) => {
  const wantedSet = computeFirstNestedKeys(result, wantedProps);
  const missingWantedProps = allProps.filter((e) => !wantedSet.has(e));

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
};

const expectValuesEquals = <T extends object>({
  wantedProps,
  expected,
  result,
  verbose,
}: {
  result: T;
  expected: T;
  wantedProps: OneLevelNestedKeyOf<T>[];
  verbose?: boolean;
}) => {
  if (verbose) {
    console.log(`Comparing ${JSON.stringify(expected)} with received ${JSON.stringify(result)}.`);
  }

  wantedProps.forEach((prop) => {
    const splitedProp = String(prop).split('.');
    const rootProp = splitedProp[0];
    const nestedProp = splitedProp[1];

    if (!result[rootProp]) {
      throw new Error(`The prop "${rootProp}" is not present in ${JSON.stringify(result)}.`);
    }

    const expectedValue = nestedProp ? expected[rootProp][nestedProp] : expected[rootProp];
    const resValue = nestedProp ? result[rootProp][nestedProp] : result[rootProp];

    if (verbose) {
      console.log(
        `Expecting ${JSON.stringify(expectedValue)} to be ${JSON.stringify(
          resValue,
        )} for key "${String(prop)}".`,
      );
    }
    expect(resValue).toEqual(expectedValue);
  });
};

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
export const expectObjects = <T extends object & { id: string }>({
  results,
  expectations,
  wantedProps,
  typeName = 'object',
  verbose = false,
}: {
  results: T[];
  expectations: T[];
  wantedProps: OneLevelNestedKeyOf<T>[];
  typeName?: string;
  verbose?: boolean;
}) => {
  console.log(`Testing ${typeName}.`);
  expect(results).toHaveLength(expectations.length);

  const allProps = getKeysAndFirstNestedKeys(results[0]);

  for (const expected of expectations) {
    const result = results.find((a) => a.id === expected.id);
    if (!result) {
      throw new Error(`${typeName} should exist`);
    }

    expectNoLeakedColumn(result, allProps, wantedProps);
    expectValuesEquals({ result, expected, wantedProps, verbose });
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
