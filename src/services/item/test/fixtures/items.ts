import { v4 as uuidv4 } from 'uuid';

import { ItemSettings, ItemType, buildPathFromIds } from '@graasp/sdk';

import { Member } from '../../../member/entities/member';
import { randomHexOf4 } from '../../../utils';
import { Item, ItemExtra } from '../../entities/Item';
import { ItemRepository } from '../../repository';

export const getDummyItem = (
  options: {
    name?: string;
    type?: ItemType;
    path?: string;
    description?: string;
    id?: string;
    // creator: Member;
    extra?: ItemExtra;
    parentPath?: string;
    settings?: ItemSettings;
  } = {},
): Item => {
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

  return  {
    id: buildId,
    name: name ?? randomHexOf4(),
    description: description ?? 'some description',
    type: type ?? ItemType.FOLDER,
    path: buildPath,
    extra: extra ?? ({} as ItemExtra),
    // creator,
    settings,
    updatedAt: new Date(),
    createdAt: new Date(),
  } as Item; // HACK: Item entity contains much more data
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

export const saveItems = async ({
  items,
  parentItem,
  actor,
}: {
  items: Item[];
  parentItem: Item;
  actor: Member;
}) => {
  for (const i of items) {
    await saveItem({ actor, parentItem, item: i });
  }
};

export const expectItem = (newItem: Partial<Item>|undefined, correctItem: Partial<Item>|undefined, creator?: Member, parent?: Item) => {
  if (!newItem || !newItem.id) {
    throw new Error('expectItem.newItem is not defined ' + JSON.stringify(newItem));
  }
  if (!correctItem) {
    throw new Error('expectItem.correctItem is not defined ' + JSON.stringify(correctItem));
  }
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

export const expectManyItems = (
  items: Item[],
  correctItems: Item[],
  creator?: Member,
  parent?: Item,
) => {
  expect(items).toHaveLength(correctItems.length);

  items.forEach(({ id }) => {
    const item = items.find(({ id: thisId }) => thisId === id);
    const correctItem = correctItems.find(({ id: thisId }) => thisId === id);
    expectItem(item, correctItem, creator, parent);
  });
};
