import {
  AppItemFactory,
  DocumentItemFactory,
  EmbeddedLinkItemFactory,
  EtherpadItemFactory,
  FolderItemFactory,
  H5PItemFactory,
  ItemType,
  LocalFileItemFactory,
  S3FileItemFactory,
  ShortcutItemFactory,
  buildPathFromIds,
} from '@graasp/sdk';

import { Actor, Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import { setItemPublic } from '../../plugins/itemTag/test/fixtures';
import { ItemRepository } from '../../repository';

export const createItem = (
  args?: Partial<Item> & {
    parentItem?: Item;
    creator?: Actor | null;
  },
): Item => {
  let item;

  // necessary cast since we don't use DiscriminatedItem
  const castedArgs = args as never;

  switch (args?.type) {
    case ItemType.APP:
      item = AppItemFactory(castedArgs);
      break;
    case ItemType.LINK:
      item = EmbeddedLinkItemFactory(castedArgs);
      break;
    case ItemType.DOCUMENT:
      item = DocumentItemFactory(castedArgs);
      break;
    case ItemType.LOCAL_FILE:
      item = LocalFileItemFactory(castedArgs);
      break;
    case ItemType.S3_FILE:
      item = S3FileItemFactory(castedArgs);
      break;
    case ItemType.H5P:
      item = H5PItemFactory(castedArgs);
      break;
    case ItemType.ETHERPAD:
      item = EtherpadItemFactory(castedArgs);
      break;
    case ItemType.SHORTCUT:
      item = ShortcutItemFactory(castedArgs);
      break;
    case ItemType.FOLDER:
    default:
      item = FolderItemFactory(castedArgs);
      break;
  }
  // by default we generate data with type date to match with entity's types
  return {
    ...item,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
};

// todo: factor out
export const saveItem = async ({
  item = {},
  actor = null,
  parentItem,
}: {
  parentItem?: Item;
  actor?: Actor | null;
  item?: Partial<Item>;
}) => {
  const value = createItem({ ...item, creator: actor, parentItem });
  return ItemRepository.save(value);
};

export const savePublicItem = async ({
  item = {},
  parentItem,
  actor,
}: {
  parentItem?: Item;
  actor: Actor | null;
  item?: Partial<Item>;
}) => {
  const value = createItem({ ...item, creator: actor, parentItem });
  const newItem = await ItemRepository.save(value);
  await setItemPublic(newItem, actor);
  return newItem;
};

export const saveItems = async ({
  nb,
  parentItem,
  actor = null,
}: {
  nb: number;
  parentItem: Item;
  actor: Actor | null;
}) => {
  for (let i = 0; i < nb; i++) {
    await saveItem({ actor, parentItem });
  }
};

export const expectItem = (
  newItem: Partial<Item> | undefined | null,
  correctItem: Partial<Omit<Item, 'createdAt' | 'updatedAt' | 'creator'>> | undefined | null,
  creator?: Member,
  parent?: Item,
) => {
  if (!newItem || !newItem.id) {
    throw new Error('expectItem.newItem is not defined ' + JSON.stringify(newItem));
  }
  if (!correctItem) {
    throw new Error('expectItem.correctItem is not defined ' + JSON.stringify(correctItem));
  }
  expect(newItem.name).toEqual(correctItem.name);
  expect(newItem.description).toEqual(correctItem.description ?? null);
  expect(newItem.extra).toEqual(correctItem.extra);
  expect(newItem.type).toEqual(correctItem.type);
  if (correctItem.lang) {
    expect(newItem.lang).toEqual(correctItem.lang);
  }
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
  correctItems: Partial<
    Pick<Item, 'id' | 'name' | 'description' | 'type' | 'extra' | 'settings'>
  >[],
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
