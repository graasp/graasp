import { v4 as uuidv4 } from 'uuid';

import { ItemType, UnknownExtra, buildPathFromIds } from '@graasp/sdk';

import { Item, ItemSettings } from '../../src/services/item/entities/Item';
import { ItemRepository } from '../../src/services/item/repository';
import { Member } from '../../src/services/member/entities/member';

const randomHexOf4 = () => ((Math.random() * (1 << 16)) | 0).toString(16).padStart(4, '0');

export const getDummyItem = (
  options: {
    name?: string;
    type?: Item['type'];
    path?: string;
    description?: string;
    id?: string;
    // creator: Member;
    extra?: UnknownExtra;
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
    settings = {} as ItemSettings,
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
    extra: extra || {},
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
