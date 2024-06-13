import { Repository } from 'typeorm';

import {
  AppItemFactory,
  DocumentItemFactory,
  EtherpadItemFactory,
  FolderItemFactory,
  H5PItemFactory,
  ItemTagType,
  ItemType,
  LinkItemFactory,
  LocalFileItemFactory,
  PermissionLevel,
  S3FileItemFactory,
  ShortcutItemFactory,
  buildPathFromIds,
} from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { ItemMembership } from '../../../itemMembership/entities/ItemMembership';
import { ItemMembershipRepository } from '../../../itemMembership/repository';
import { Actor, Member } from '../../../member/entities/member';
import { ItemWrapper, PackedItem } from '../../ItemWrapper';
import { DEFAULT_ORDER, Item, ItemExtraMap } from '../../entities/Item';
import { ItemTag } from '../../plugins/itemTag/ItemTag';
import { ItemTagRepository } from '../../plugins/itemTag/repository';
import { setItemPublic } from '../../plugins/itemTag/test/fixtures';
import { ItemPublished } from '../../plugins/published/entities/itemPublished';
import { RecycledItemDataRepository } from '../../plugins/recycled/repository';
import { ItemRepository } from '../../repository';

export class ItemTestUtils {
  public itemRepository: ItemRepository;
  public itemTagRepository: ItemTagRepository;
  public rawItemRepository: Repository<Item<keyof ItemExtraMap>>;
  recycledItemDataRepository: typeof RecycledItemDataRepository;
  rawItemPublishedRepository: Repository<ItemPublished>;

  constructor() {
    this.itemRepository = new ItemRepository();
    this.itemTagRepository = new ItemTagRepository();
    this.rawItemRepository = AppDataSource.getRepository(Item);
    this.recycledItemDataRepository = RecycledItemDataRepository;
    this.rawItemPublishedRepository = AppDataSource.getRepository(ItemPublished);
  }

  createItem(
    args?: Partial<Item> & {
      parentItem?: Item;
      creator?: Actor | null;
    },
  ): Item {
    let item;

    // necessary cast since we don't use DiscriminatedItem
    const castedArgs = args as never;

    switch (args?.type) {
      case ItemType.APP:
        item = AppItemFactory(castedArgs);
        break;
      case ItemType.LINK:
        item = LinkItemFactory(castedArgs);
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
      deletedAt: null,
      order: args?.order ?? DEFAULT_ORDER,
    };
  }

  // todo: factor out
  async saveItem({
    item = {},
    actor = null,
    parentItem,
  }: {
    parentItem?: Item;
    actor?: Actor | null;
    item?: Partial<Item>;
  }) {
    const value = this.createItem({ ...item, creator: actor, parentItem });
    return this.rawItemRepository.save(value);
  }

  savePublicItem = async ({
    item = {},
    parentItem,
    actor,
  }: {
    parentItem?: Item;
    actor: Actor | null;
    item?: Partial<Item>;
  }) => {
    const value = this.createItem({ ...item, creator: actor, parentItem });
    const newItem = await this.rawItemRepository.save(value);
    const publicTag = await setItemPublic(newItem, actor);
    return {
      item: newItem,
      packedItem: new ItemWrapper(newItem, undefined, [publicTag]).packed(),
      publicTag,
    };
  };

  saveItems = async ({
    nb,
    parentItem,
    actor = null,
  }: {
    nb: number;
    parentItem: Item;
    actor: Actor | null;
  }) => {
    for (let i = 0; i < nb; i++) {
      await this.saveItem({ actor, parentItem });
    }
  };

  saveMembership = ({
    item,
    member,
    permission = PermissionLevel.Admin,
  }: {
    item: Item;
    member: Actor;
    permission?: PermissionLevel;
  }) => {
    return ItemMembershipRepository.save({ item, member, permission });
  };

  saveItemAndMembership = async (options: {
    member: Actor;
    item?: Partial<Item>;
    permission?: PermissionLevel;
    creator?: Member;
    parentItem?: Item;
  }): Promise<{
    item: Item;
    itemMembership: ItemMembership;
    packedItem: PackedItem;
  }> => {
    const { item, member, permission, creator, parentItem } = options;
    const newItem = await this.saveItem({
      item,
      actor: creator ?? member,
      parentItem,
    });
    const im = await this.saveMembership({ item: newItem, member, permission });
    return {
      item: newItem,
      itemMembership: im,
      packedItem: new ItemWrapper(newItem as Item, im).packed(),
    };
  };

  saveRecycledItem = async (member: Member, defaultItem?: Item) => {
    let item = defaultItem;
    let packedItem;
    if (!item) {
      ({ item, packedItem } = await this.saveItemAndMembership({ member }));
    }
    await this.recycledItemDataRepository.recycleOne(item, member);
    await this.rawItemRepository.softRemove(item);
    return { item, packedItem };
  };

  saveCollections = async (member) => {
    const items: Item[] = [];
    const packedItems: PackedItem[] = [];
    const tags: ItemTag[] = [];
    for (let i = 0; i < 3; i++) {
      const { item, itemMembership } = await this.saveItemAndMembership({ member });
      items.push(item);
      const publicTag = await setItemPublic(item, member);
      packedItems.push(new ItemWrapper(item, itemMembership, [publicTag]).packed());
      tags.push(publicTag);
      await this.rawItemPublishedRepository.save({ item, creator: member });
    }
    return { items, packedItems, tags };
  };
}
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

  if (correctItem.settings) {
    for (const [k, s] of Object.entries(correctItem.settings)) {
      expect(newItem.settings![k]).toEqual(s);
    }
  }
};

export const expectPackedItem = (
  newItem: Partial<PackedItem> | undefined | null,
  correctItem:
    | (Partial<Omit<PackedItem, 'createdAt' | 'updatedAt' | 'creator'>> &
        Pick<PackedItem, 'permission'>)
    | undefined
    | null,
  creator?: Member,
  parent?: Item,
  tags?: ItemTag[],
) => {
  expectItem(newItem, correctItem, creator, parent);

  expect(newItem!.permission).toEqual(correctItem?.permission);

  const pTag = tags?.find((t) => t.type === ItemTagType.Public);
  if (pTag) {
    expect(newItem!.public!.type).toEqual(pTag.type);
    expect(newItem!.public!.id).toEqual(pTag.id);
    expect(newItem!.public!.item!.id).toEqual(pTag.item.id);
  }
  const hTag = tags?.find((t) => t.type === ItemTagType.Hidden);
  if (hTag) {
    expect(newItem!.hidden!.type).toEqual(hTag.type);
    expect(newItem!.hidden!.id).toEqual(hTag.id);
    expect(newItem!.hidden!.item!.id).toEqual(hTag.item.id);
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

export const expectManyPackedItems = (
  items: PackedItem[],
  correctItems: (Partial<
    Pick<PackedItem, 'id' | 'name' | 'description' | 'type' | 'extra' | 'settings'>
  > &
    Pick<PackedItem, 'permission'>)[],
  creator?: Member,
  parent?: Item,
  tags?: ItemTag[],
) => {
  expect(items).toHaveLength(correctItems.length);

  items.forEach(({ id }) => {
    const item = items.find(({ id: thisId }) => thisId === id);
    const correctItem = correctItems.find(({ id: thisId }) => thisId === id);
    const tTags = tags?.filter((t) => t.item.id === id);
    expectPackedItem(item, correctItem, creator, parent, tTags);
  });
};
