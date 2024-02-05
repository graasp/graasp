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

export const createItem = (args?): Item => {
  let item;
  switch (args?.type) {
    case ItemType.APP:
      item = AppItemFactory(args);
      break;
    case ItemType.LINK:
      item = EmbeddedLinkItemFactory(args);
      break;
    case ItemType.DOCUMENT:
      item = DocumentItemFactory(args);
      break;
    case ItemType.LOCAL_FILE:
      item = LocalFileItemFactory(args);
      break;
    case ItemType.S3_FILE:
      item = S3FileItemFactory(args);
      break;
    case ItemType.H5P:
      item = H5PItemFactory(args);
      break;
    case ItemType.ETHERPAD:
      item = EtherpadItemFactory(args);
      break;
    case ItemType.SHORTCUT:
      item = ShortcutItemFactory(args);
      break;
    case ItemType.FOLDER:
    default:
      item = FolderItemFactory(args);
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
  correctItem:
    | Partial<Pick<Item, 'id' | 'name' | 'description' | 'type' | 'extra' | 'settings' | 'lang'>>
    | undefined
    | null,
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
