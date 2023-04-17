import { v4 as uuidv4 } from 'uuid';

import { ItemSettings, ItemType, buildPathFromIds } from '@graasp/sdk';

import { Member } from '../../../member/entities/member';
import { randomHexOf4 } from '../../../utils';
import { Item, ItemExtra } from '../../entities/Item';
import { ItemRepository } from '../../repository';

export const getDummyItem = (
  options: {
    name?: string;
    type?: Item['type'];
    path?: string;
    description?: string;
    id?: string;
    // creator: Member;
    extra?: ItemExtra;
    parentPath?: string;
    settings?: ItemSettings;
  } = {},
): Partial<Item> => {
  const {
    type,
    parentPath,
    id,
    description,
    path,
    // creator ,
    extra,
    name,
    settings = {},
  } = options;
  const buildId = id ?? uuidv4();
  let buildPath = path ?? buildPathFromIds(buildId);
  if (parentPath) buildPath = `${parentPath}.${buildPath}`;

  return {
    id: buildId,
    name: name ?? randomHexOf4(),
    description: description ?? 'some description',
    type: type ?? ItemType.FOLDER,
    path: buildPath,
    extra: extra ?? ({} as ItemExtra),
    // creator,
    settings,
  };
};

// todo: factor out
export const saveItem = async ({
  item,
  parentItem,
  actor,
}: {
  parentItem?: Item;
  actor: Member;
  item: Partial<Item>;
}) => {
  return ItemRepository.post(item, actor, parentItem);
};

export const saveItems = async ({ items, parentItem, actor }) => {
  for (const i of items) {
    await saveItem({ actor, parentItem, item: i });
  }
};

export const expectItem = (newItem, correctItem, creator?: Member, parent?: Item) => {
  expect(newItem.name).toEqual(correctItem.name);
  expect(newItem.description).toEqual(correctItem.description);
  expect(newItem.extra).toEqual(correctItem.extra);
  expect(newItem.type).toEqual(correctItem.type);

  expect(newItem.path).toContain(buildPathFromIds(newItem.id));
  if (parent) {
    expect(newItem.path).toContain(buildPathFromIds(parent.path));
  }

  if (newItem.creator && creator) {
    expect(newItem.creator.id).toEqual(creator.id);
  }
};

export const expectManyItems = (items, correctItems, creator?: Member, parent?: Item) => {
  expect(items).toHaveLength(correctItems.length);

  items.forEach(({ id }) => {
    expectItem(
      items.find(({ id: thisId }) => thisId === id),
      correctItems.find(({ id: thisId }) => thisId === id),
      creator,
      parent,
    );
  });
};
