import { Repository } from 'typeorm';

import {
  AppItemFactory,
  DocumentItemFactory,
  FolderItemFactory,
  ItemType,
  ItemVisibilityType,
  LinkItemFactory,
  LocalFileItemFactory,
  PermissionLevel,
  S3FileItemFactory,
  ShortcutItemFactory,
  ThumbnailSize,
  buildPathFromIds,
} from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { Guest } from '../../../itemLogin/entities/guest';
import { ItemMembership } from '../../../itemMembership/entities/ItemMembership';
import { Member, isMember } from '../../../member/entities/member';
import { saveMember } from '../../../member/test/fixtures/members';
import { ItemWrapper, PackedItem } from '../../ItemWrapper';
import { DEFAULT_ORDER, Item, ItemExtraMap } from '../../entities/Item';
import { ItemVisibility } from '../../plugins/itemVisibility/ItemVisibility';
import { ItemVisibilityRepository } from '../../plugins/itemVisibility/repository';
import { setItemPublic } from '../../plugins/itemVisibility/test/fixtures';
import { ItemPublished } from '../../plugins/publication/published/entities/itemPublished';
import { RecycledItemDataRepository } from '../../plugins/recycled/repository';
import { ItemRepository } from '../../repository';

const itemMembershipRawRepository = AppDataSource.getRepository(ItemMembership);

export class ItemTestUtils {
  public itemRepository: ItemRepository;
  public itemVisibilityRepository: ItemVisibilityRepository;
  public rawItemRepository: Repository<Item<keyof ItemExtraMap>>;
  recycledItemDataRepository: RecycledItemDataRepository;
  rawItemPublishedRepository: Repository<ItemPublished>;

  constructor() {
    this.itemRepository = new ItemRepository();
    this.itemVisibilityRepository = new ItemVisibilityRepository();
    this.rawItemRepository = AppDataSource.getRepository(Item);
    this.recycledItemDataRepository = new RecycledItemDataRepository();
    this.rawItemPublishedRepository = AppDataSource.getRepository(ItemPublished);
  }

  createItem(
    args?: Partial<Item> & {
      parentItem?: Item;
      creator?: Member | null;
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
      // allows null order for root items
      order: args?.parentItem ? (args.order ?? DEFAULT_ORDER) : null,
    };
  }

  // todo: factor out
  async saveItem({
    item = {},
    actor = null,
    parentItem,
  }: {
    parentItem?: Item;
    actor?: Member | null;
    item?: Partial<Item>;
  }) {
    const value = this.createItem({ ...item, creator: actor, parentItem });
    return this.rawItemRepository.save(value);
  }

  savePublicItem = async ({
    item = {},
    parentItem,
    member,
  }: {
    parentItem?: Item;
    member?: Member | null;
    item?: Partial<Item>;
  }) => {
    const value = this.createItem({ ...item, creator: member, parentItem });
    const newItem = await this.rawItemRepository.save(value);
    const publicVisibility = await setItemPublic(newItem, member);
    return {
      item: newItem,
      packedItem: new ItemWrapper(newItem, undefined, [publicVisibility]).packed(),
      publicVisibility,
    };
  };

  saveItems = async ({
    nb,
    parentItem,
    member = null,
  }: {
    nb: number;
    parentItem: Item;
    member?: Member | null;
  }) => {
    for (let i = 0; i < nb; i++) {
      await this.saveItem({ actor: member, parentItem });
    }
  };

  saveMembership = async ({
    item,
    account,
    permission = PermissionLevel.Admin,
  }: {
    item: Item;
    account: Member | Guest;
    permission?: PermissionLevel;
  }) => {
    return await itemMembershipRawRepository.save({ item, account, permission });
  };

  saveItemAndMembership = async (options: {
    member?: Member | Guest;
    item?: Partial<Item>;
    permission?: PermissionLevel;
    creator?: Member;
    parentItem?: Item;
  }): Promise<{
    item: Item;
    itemMembership: ItemMembership;
    packedItem: PackedItem;
  }> => {
    const { item, permission, creator = null, parentItem, member } = options;
    // use given creator, or member if it is a member
    let itemCreator = creator;
    if (!creator && member && isMember(member)) {
      itemCreator = member;
    }

    const newItem = await this.saveItem({
      item,
      actor: itemCreator,
      parentItem,
    });
    const im = await this.saveMembership({
      item: newItem,
      account: member ?? (await saveMember()),
      permission,
    });
    return {
      item: newItem,
      itemMembership: im,
      packedItem: new ItemWrapper(newItem as Item, im).packed(),
    };
  };

  saveRecycledItem = async (member: Member, defaultItem?: Item) => {
    let item = defaultItem;
    if (!item) {
      ({ item } = await this.saveItemAndMembership({ member }));
    }
    await this.recycledItemDataRepository.addOne({ itemPath: item.path, creatorId: member.id });
    await this.rawItemRepository.softRemove(item);
    return { item };
  };

  saveCollections = async (member: Member) => {
    const items: Item[] = [];
    const packedItems: PackedItem[] = [];
    const visibilities: ItemVisibility[] = [];
    for (let i = 0; i < 3; i++) {
      const { item, itemMembership } = await this.saveItemAndMembership({ member });
      items.push(item);
      const publicVisibility = await setItemPublic(item, member);
      packedItems.push(new ItemWrapper(item, itemMembership, [publicVisibility]).packed());
      visibilities.push(publicVisibility);
      await this.rawItemPublishedRepository.save({ item, creator: member });
    }
    return { items, packedItems, visibilities };
  };

  getOrderForItemId = async (itemId: Item['id']): Promise<number | null> => {
    const order = (await this.rawItemRepository
      .createQueryBuilder('item')
      .select('item."order"')
      .where(`id = '${itemId}'`)
      // needs to get raw otherwise we cannot get null order
      .getRawOne<{ order: string }>())!.order;
    // return null value
    // TODO: check returns null
    if (!order) {
      return order as unknown as null;
    }
    // return float order
    return parseFloat(order);
  };

  expectOrder = async (itemId: string, previousItemId?: string, nextItemId?: string) => {
    const thisOrder = await this.getOrderForItemId(itemId);
    if (previousItemId) {
      const previousItemOrder = (await this.getOrderForItemId(previousItemId))!;
      if (previousItemOrder) {
        expect(thisOrder).toBeGreaterThan(previousItemOrder);
      } else {
        expect(thisOrder).toBeNull();
      }
    }

    if (nextItemId) {
      const nextOrder = await this.getOrderForItemId(nextItemId);
      if (nextOrder) {
        expect(thisOrder).toBeLessThan(nextOrder);
      } else {
        expect(thisOrder).toBeNull();
      }
    }
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
  visibilities?: ItemVisibility[],
) => {
  expectItem(newItem, correctItem, creator, parent);

  expect(newItem!.permission).toEqual(correctItem?.permission);

  const pVisibility = visibilities?.find((t) => t.type === ItemVisibilityType.Public);
  if (pVisibility) {
    expect(newItem!.public!.type).toEqual(pVisibility.type);
    expect(newItem!.public!.id).toEqual(pVisibility.id);
    expect(newItem!.public!.item!.id).toEqual(pVisibility.item.id);
  }
  const hVisibility = visibilities?.find((t) => t.type === ItemVisibilityType.Hidden);
  if (hVisibility) {
    expect(newItem!.hidden!.type).toEqual(hVisibility.type);
    expect(newItem!.hidden!.id).toEqual(hVisibility.id);
    expect(newItem!.hidden!.item!.id).toEqual(hVisibility.item.id);
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
  visibilities?: ItemVisibility[],
) => {
  expect(items).toHaveLength(correctItems.length);

  items.forEach(({ id }) => {
    const item = items.find(({ id: thisId }) => thisId === id);
    const correctItem = correctItems.find(({ id: thisId }) => thisId === id);
    const tVisibilities = visibilities?.filter((t) => t.item.id === id);
    expectPackedItem(item, correctItem, creator, parent, tVisibilities);
  });
};

export const expectThumbnails = (
  item: PackedItem,
  thumbnailUrl: string,
  shouldContainThumbnails: boolean,
) => {
  if (shouldContainThumbnails) {
    expect(item.thumbnails).toBeDefined();
    expect(item.thumbnails![ThumbnailSize.Small]).toBe(thumbnailUrl);
    expect(item.thumbnails![ThumbnailSize.Medium]).toBe(thumbnailUrl);
  } else {
    expect(item.thumbnails).toBeUndefined();
  }
};
