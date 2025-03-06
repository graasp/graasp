import { Readable } from 'stream';
import { delay, inject, injectable, singleton } from 'tsyringe';

import {
  ItemType,
  ItemVisibilityType,
  MAX_DESCENDANTS_FOR_COPY,
  MAX_DESCENDANTS_FOR_DELETE,
  MAX_DESCENDANTS_FOR_MOVE,
  MAX_ITEM_NAME_LENGTH,
  MAX_NUMBER_OF_CHILDREN,
  Paginated,
  Pagination,
  PermissionLevel,
  PermissionLevelCompare,
  UUID,
  buildPathFromIds,
  getIdsFromPath,
  getParentFromPath,
} from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import {
  Item,
  ItemGeolocationRaw,
  ItemRaw,
  ItemTypeUnion,
  ItemWithCreator,
  MinimalItemForInsert,
} from '../../drizzle/types';
import { BaseLogger } from '../../logger';
import { AuthenticatedUser, MaybeUser, MinimalMember } from '../../types';
import {
  CannotReorderRootItem,
  InvalidMembership,
  ItemNotFolder,
  MissingNameOrTypeForItemError,
  TooManyChildren,
  TooManyDescendants,
  UnauthorizedMember,
} from '../../utils/errors';
import HookManager from '../../utils/hook';
import {
  AuthorizationService,
  filterOutItems,
  filterOutPackedDescendants,
  filterOutPackedItems,
} from '../authorization';
import { ItemMembershipRepository } from '../itemMembership/repository';
import { ThumbnailService } from '../thumbnail/service';
import { ItemWrapper, ItemWrapperService, PackedItem } from './ItemWrapper';
import { BasicItemService } from './basic.service';
import { IS_COPY_REGEX, MAX_COPY_SUFFIX_LENGTH } from './constants';
import { FolderItem, isItemType } from './discrimination';
import { PartialItemGeolocation } from './plugins/geolocation/errors';
import { ItemGeolocationRepository } from './plugins/geolocation/repository';
import { ItemVisibilityRepository } from './plugins/itemVisibility/repository';
import { ItemPublishedRepository } from './plugins/publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from './plugins/publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from './plugins/thumbnail/service';
import { ItemRepository } from './repository';
import { ItemChildrenParams, ItemSearchParams } from './types';

@injectable()
export class ItemService {
  private readonly log: BaseLogger;
  private readonly thumbnailService: ThumbnailService;
  private readonly meilisearchWrapper: MeiliSearchWrapper;
  private readonly itemThumbnailService: ItemThumbnailService;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemGeolocationRepository: ItemGeolocationRepository;
  private readonly itemPublishedRepository: ItemPublishedRepository;
  protected readonly itemRepository: ItemRepository;
  private readonly authorizationService: AuthorizationService;
  private readonly itemWrapperService: ItemWrapperService;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;
  public readonly basicItemService: BasicItemService;

  hooks = new HookManager<{
    create: { pre: { item: Partial<Item> }; post: { item: Item } };
    update: { pre: { item: Item }; post: { item: Item } };
    delete: { pre: { item: Item }; post: { item: Item } };
    copy: { pre: { original: Item }; post: { original: Item; copy: MinimalItemForInsert } };
    move: {
      pre: {
        /** the item to be moved itself */
        source: Item;
        /** the parent item where the item will be moved */
        destinationParent?: Item;
      };
      post: {
        /** the item before it was moved */
        source: Item;
        /** id of the previous parent */
        sourceParentId?: UUID;
        /** the item itself once moved */
        destination: Item;
      };
    };
  }>();

  constructor(
    thumbnailService: ThumbnailService,
    @inject(delay(() => ItemThumbnailService))
    itemThumbnailService: ItemThumbnailService,
    itemMembershipRepository: ItemMembershipRepository,
    meilisearchWrapper: MeiliSearchWrapper,
    itemRepository: ItemRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemGeolocationRepository: ItemGeolocationRepository,
    authorizationService: AuthorizationService,
    itemWrapperService: ItemWrapperService,
    itemVisibilityRepository: ItemVisibilityRepository,
    basicItemService: BasicItemService,
    log: BaseLogger,
  ) {
    this.thumbnailService = thumbnailService;
    this.itemThumbnailService = itemThumbnailService;
    this.itemMembershipRepository = itemMembershipRepository;
    this.meilisearchWrapper = meilisearchWrapper;
    this.itemPublishedRepository = itemPublishedRepository;
    this.itemGeolocationRepository = itemGeolocationRepository;
    this.itemRepository = itemRepository;
    this.authorizationService = authorizationService;
    this.itemWrapperService = itemWrapperService;
    this.itemVisibilityRepository = itemVisibilityRepository;
    this.basicItemService = basicItemService;
    this.log = log;
  }

  async post(
    db: DBConnection,
    member: MinimalMember,
    args: {
      item: Partial<ItemRaw> & Pick<ItemRaw, 'name' | 'type'>;
      parentId?: string;
      geolocation?: Pick<ItemGeolocationRaw, 'lat' | 'lng'>;
      thumbnail?: Readable;
      previousItemId?: Item['id'];
    },
  ) {
    const { item, parentId, geolocation, thumbnail } = args;

    // name and type should exist
    if (!item.name || !item.type) {
      throw new MissingNameOrTypeForItemError(item);
    }

    // lat and lng should exist together
    const { lat, lng } = geolocation || {};
    if ((lat && !lng) || (lng && !lat)) {
      throw new PartialItemGeolocation({ lat, lng });
    }

    this.log.debug(`run prehook for ${item.name}`);
    await this.hooks.runPreHooks('create', member, db, { item }, this.log);

    let inheritedMembership;
    let parentItem: Item | undefined = undefined;
    // TODO: HOOK?
    // check permission over parent
    if (parentId) {
      this.log.debug(`verify parent ${parentId} exists and has permission over it`);
      parentItem = await this.basicItemService.get(db, member, parentId, PermissionLevel.Write);
      inheritedMembership = await this.itemMembershipRepository.getInherited(
        db,
        parentItem.path,
        member.id,
        true,
      );

      // quick check, necessary for ts
      if (parentItem.type !== ItemType.FOLDER) {
        throw new ItemNotFolder(parentItem);
      }

      this.itemRepository.checkHierarchyDepth(parentItem);

      // check if there's too many children under the same parent
      const descendants = await this.itemRepository.getChildren(db, member, parentItem);
      if (descendants.length + 1 > MAX_NUMBER_OF_CHILDREN) {
        throw new TooManyChildren();
      }

      // no previous item adds at the beginning
      if (!args.previousItemId) {
        item.order = await this.itemRepository.getFirstOrderValue(db, parentItem.path);
      }
      // define order, from given previous item id if exists
      else {
        item.order = await this.itemRepository.getNextOrderCount(
          db,
          parentItem.path,
          args.previousItemId,
        );
      }
    }

    this.log.debug(`create item ${item.name}`);
    const createdItem = await this.itemRepository.addOne(db, {
      item,
      creator: member,
      parentItem,
    });
    this.log.debug(`item ${item.name} is created: ${createdItem}`);

    // create membership if inherited is less than admin
    if (
      !inheritedMembership ||
      PermissionLevelCompare.lt(inheritedMembership?.permission, PermissionLevel.Admin)
    ) {
      this.log.debug(`create membership for ${createdItem.id}`);
      await this.itemMembershipRepository.addOne(db, {
        itemPath: createdItem.path,
        accountId: member.id,
        creatorId: member.id,
        permission: PermissionLevel.Admin,
      });
    }

    this.log.debug(`run posthook for ${createdItem.id}`);
    await this.hooks.runPostHooks('create', member, db, { item: createdItem }, this.log);

    // geolocation
    if (geolocation) {
      await this.itemGeolocationRepository.put(db, createdItem.path, geolocation);
    }

    // thumbnail
    if (thumbnail) {
      await this.thumbnailService.upload(member, createdItem.id, thumbnail);
      await this.patch(db, member, createdItem.id, {
        settings: { hasThumbnail: true },
      });
      // set in the item
      createdItem.settings = { hasThumbnail: true };
    }
    return createdItem;
  }

  /**
   * get an item packed with complementary info
   * @param actor
   * @param id
   * @param permission
   * @returns
   */
  async getPacked(
    db: DBConnection,
    actor: MaybeUser,
    id: string,
    permission: PermissionLevel = PermissionLevel.Read,
  ) {
    const { item, itemMembership, visibilities } = await this.basicItemService._get(
      db,
      actor,
      id,
      permission,
    );
    const thumbnails = await this.itemThumbnailService.getUrlsByItems([item]);

    return new ItemWrapper(item, itemMembership, visibilities, thumbnails[item.id]).packed();
  }

  /**
   * get item packed with complementary items
   * @param actor
   * @param ids
   * @returns
   */
  async getManyPacked(db: DBConnection, actor: MaybeUser, ids: string[]) {
    const { items, itemMemberships, visibilities } = await this.basicItemService._getMany(
      db,
      actor,
      ids,
    );

    const thumbnails = await this.itemThumbnailService.getUrlsByItems(Object.values(items.data));

    return this.itemWrapperService.mergeResult(items, itemMemberships, visibilities, thumbnails);
  }

  async getAccessible(
    db: DBConnection,
    member: MinimalMember,
    params: ItemSearchParams,
    pagination: Pagination,
  ): Promise<Paginated<PackedItem>> {
    const { data: items, totalCount } = await this.itemRepository.getAccessibleItems(
      db,
      member,
      params,
      pagination,
    );

    const packedItems = await this.itemWrapperService.createPackedItems(db, items);
    return { data: packedItems, totalCount, pagination };
  }

  private async _getChildren(
    db: DBConnection,
    actor: MaybeUser,
    itemId: string,
    params?: ItemChildrenParams,
  ) {
    const item = await this.basicItemService.get(db, actor, itemId);

    return this.itemRepository.getChildren(db, actor, item, params);
  }

  async getChildren(
    db: DBConnection,
    actor: MaybeUser,
    itemId: string,
    params?: ItemChildrenParams,
  ) {
    const children = await this._getChildren(db, actor, itemId, params);
    // TODO optimize?
    return filterOutItems(
      db,
      actor,
      {
        itemMembershipRepository: this.itemMembershipRepository,
        itemVisibilityRepository: this.itemVisibilityRepository,
      },
      children,
    );
  }

  async getPackedChildren(
    db: DBConnection,
    actor: MaybeUser,
    itemId: string,
    params?: ItemChildrenParams,
  ) {
    const children = await this._getChildren(db, actor, itemId, params);
    const thumbnails = await this.itemThumbnailService.getUrlsByItems(children);

    // TODO optimize?
    return filterOutPackedItems(
      db,
      actor,
      {
        itemMembershipRepository: this.itemMembershipRepository,
        itemVisibilityRepository: this.itemVisibilityRepository,
      },
      children,
      thumbnails,
    );
  }

  private async getDescendants(
    db: DBConnection,
    actor: MaybeUser,
    itemId: UUID,
    options?: { types?: ItemTypeUnion[] },
  ) {
    const item = await this.basicItemService.get(db, actor, itemId);

    if (!isItemType(item, ItemType.FOLDER)) {
      return { item, descendants: <ItemWithCreator[]>[] };
    }

    return {
      item,
      descendants: await this.itemRepository.getDescendants(db, item, options),
    };
  }

  async getFilteredDescendants(db: DBConnection, account: MaybeUser, itemId: UUID) {
    const { descendants } = await this.getDescendants(db, account, itemId);
    if (!descendants.length) {
      return [];
    }
    // TODO optimize?
    return filterOutItems(
      db,
      account,
      {
        itemMembershipRepository: this.itemMembershipRepository,
        itemVisibilityRepository: this.itemVisibilityRepository,
      },
      descendants,
    );
  }

  async getPackedDescendants(
    db: DBConnection,
    actor: MaybeUser,
    itemId: UUID,
    options?: { showHidden?: boolean; types?: ItemTypeUnion[] },
  ) {
    const { descendants, item } = await this.getDescendants(db, actor, itemId, options);
    if (!descendants.length) {
      return [];
    }
    const thumbnails = await this.itemThumbnailService.getUrlsByItems(descendants);
    return filterOutPackedDescendants(
      db,
      actor,
      {
        itemMembershipRepository: this.itemMembershipRepository,
        itemVisibilityRepository: this.itemVisibilityRepository,
      },
      item,
      descendants,
      thumbnails,
      options,
    );
  }

  async getParents(db: DBConnection, actor: MaybeUser, itemId: UUID) {
    const item = await this.basicItemService.get(db, actor, itemId);
    const parents = await this.itemRepository.getAncestors(db, item);

    const { itemMemberships, visibilities } =
      await this.authorizationService.validatePermissionMany(
        db,
        PermissionLevel.Read,
        actor,
        parents,
      );
    // remove parents actor does not have access
    const parentsIds = Object.keys(itemMemberships.data);
    const items = parents.filter((p) => parentsIds.includes(p.id));
    const thumbnails = await this.itemThumbnailService.getUrlsByItems(items);
    return this.itemWrapperService.merge(items, itemMemberships, visibilities, thumbnails);
  }

  async patch(db: DBConnection, member: MinimalMember, itemId: UUID, body: Partial<Item>) {
    // check memberships
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    await this.authorizationService.validatePermission(
      db,

      PermissionLevel.Write,
      member,
      item,
    );

    await this.hooks.runPreHooks('update', member, db, { item: item });

    const updated = await this.itemRepository.updateOne(db, item.id, body);

    await this.hooks.runPostHooks('update', member, db, { item: updated });

    return updated;
  }

  // QUESTION? DELETE BY PATH???
  async delete(db: DBConnection, actor: MinimalMember, itemId: UUID) {
    // check memberships
    const item = await this.itemRepository.getDeletedById(db, itemId);
    await this.authorizationService.validatePermission(db, PermissionLevel.Admin, actor, item);

    // check how "big the tree is" below the item
    // we do not use checkNumberOfDescendants because we use descendants
    let items = [item];
    if (isItemType(item, ItemType.FOLDER)) {
      const descendants = await this.itemRepository.getDescendants(db, item, {
        ordered: false,
      });
      if (descendants.length > MAX_DESCENDANTS_FOR_DELETE) {
        throw new TooManyDescendants(itemId);
      }
      items = [...descendants, item];
    }

    // pre hook
    for (const item of items) {
      await this.hooks.runPreHooks('delete', actor, db, { item });
    }

    await this.itemRepository.delete(
      db,
      items.map((i) => i.id),
    );

    // post hook
    for (const item of items) {
      await this.hooks.runPostHooks('delete', actor, db, { item });
    }

    return item;
  }

  // QUESTION? DELETE BY PATH???
  async deleteMany(db: DBConnection, actor: MinimalMember, itemIds: string[]) {
    if (!actor) {
      throw new UnauthorizedMember();
    }

    // check memberships
    // can get soft deleted items
    // QUESTION: move to recycle bin and the endpoint can only delete recycled items
    const { data: itemsMap } = await this.itemRepository.getMany(db, itemIds, {
      throwOnError: true,
      withDeleted: true,
    });
    const allItems = Object.values(itemsMap);

    // TODO: optimize
    const allDescendants = await Promise.all(
      allItems.map(async (item) => {
        await this.authorizationService.validatePermission(db, PermissionLevel.Admin, actor, item);
        if (!isItemType(item, ItemType.FOLDER)) {
          return [];
        }
        // check how "big the tree is" below the item
        // we do not use checkNumberOfDescendants because we use descendants
        const descendants = await this.itemRepository.getDescendants(db, item, {
          ordered: false,
        });
        if (descendants.length > MAX_DESCENDANTS_FOR_DELETE) {
          throw new TooManyDescendants(item.id);
        }
        return descendants;
      }),
    );

    const items = [...allDescendants.flat(), ...allItems];

    // pre hook
    for (const item of items) {
      await this.hooks.runPreHooks('delete', actor, db, { item });
    }

    await this.itemRepository.delete(
      db,
      items.map((i) => i.id),
    );

    // post hook
    for (const item of items) {
      await this.hooks.runPostHooks('delete', actor, db, { item });
    }

    return allItems;
  }

  /////// -------- MOVE
  async move(db: DBConnection, member: MinimalMember, itemId: UUID, parentItem?: FolderItem) {
    const item = await this.itemRepository.getOneOrThrow(db, itemId);

    await this.authorizationService.validatePermission(db, PermissionLevel.Admin, member, item);

    // check how "big the tree is" below the item
    await this.itemRepository.checkNumberOfDescendants(db, item, MAX_DESCENDANTS_FOR_MOVE);

    if (parentItem) {
      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await this.itemRepository.getNumberOfLevelsToFarthestChild(
        db,
        item,
      );
      await this.itemRepository.checkHierarchyDepth(parentItem, levelsToFarthestChild);
    }

    // post hook
    // question: invoque on all items?
    await this.hooks.runPreHooks('move', member, db, {
      source: item,
      destinationParent: parentItem,
    });

    const result = await this._move(db, member, item, parentItem);

    await this.hooks.runPostHooks('move', member, db, {
      source: item,
      sourceParentId: getParentFromPath(item.path),
      // QUESTION: send notification for root item?
      destination: result[0],
    });

    return { item, moved: result };
  }

  // TODO: optimize
  async moveMany(db: DBConnection, member: MinimalMember, itemIds: string[], toItemId?: string) {
    let parentItem: FolderItem | undefined = undefined;
    if (toItemId) {
      parentItem = (await this.basicItemService.get(
        db,
        member,
        toItemId,
        PermissionLevel.Write,
      )) as FolderItem;
    }

    const results = await Promise.all(itemIds.map((id) => this.move(db, member, id, parentItem)));

    // newly moved items needs rescaling since they are added in parallel
    if (parentItem) {
      await this.itemRepository.rescaleOrder(db, member, parentItem);
    }

    return {
      items: results.map(({ item }) => item),
      moved: results.map(({ moved }) => moved),
    };
  }

  /**
   * Does the work of moving the item and the necessary changes to all the item memberships
   * involved.
   *
   * `this.itemMembershipService.moveHousekeeping()` runs first because membership paths
   * are *automatically* updated (`ON UPDATE CASCADE`) with `this.itemService.move()` and the
   * "adjustments" need to be calculated before - considering the origin membership paths.
   *
   * * `inserts`' `itemPath`s already have the expected paths for the destination;
   * * `deletes`' `itemPath`s have the path changes after `this.itemService.move()`.
   */
  async _move(db: DBConnection, actor: MinimalMember, item: Item, parentItem?: Item) {
    // identify all the necessary adjustments to memberships
    // TODO: maybe this whole 'magic' should happen in a db procedure?
    const { inserts, deletes } = await this.itemMembershipRepository.moveHousekeeping(
      db,
      item,
      actor,
      parentItem,
    );

    const result = await this.itemRepository.move(db, item, parentItem);

    // adjust memberships to keep the constraints
    if (inserts.length) {
      await this.itemMembershipRepository.addMany(db, inserts);
    }
    if (deletes.length) {
      await this.itemMembershipRepository.deleteManyByItemPathAndAccount(db, deletes);
    }

    return result;
  }

  /////// -------- COPY
  async copy(db: DBConnection, member: MinimalMember, itemId: UUID, parentItem?: FolderItem) {
    const item = await this.basicItemService.get(db, member, itemId);

    if (parentItem) {
      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await this.itemRepository.getNumberOfLevelsToFarthestChild(
        db,
        item,
      );
      await this.itemRepository.checkHierarchyDepth(parentItem, levelsToFarthestChild);
    }

    // check how "big the tree is" below the item
    await this.itemRepository.checkNumberOfDescendants(db, item, MAX_DESCENDANTS_FOR_COPY);

    let items = [item];
    if (isItemType(item, ItemType.FOLDER)) {
      const descendants = await this.itemRepository.getDescendants(db, item, {
        ordered: false,
      });
      items = [...descendants, item];
    }

    // pre hook
    for (const original of items) {
      await this.hooks.runPreHooks('copy', member, db, { original });
    }

    let siblings: string[] = [];
    let startWith: string = item.name;
    if (IS_COPY_REGEX.test(startWith)) {
      const suffixStart = startWith.lastIndexOf('(');
      startWith = startWith.substring(0, suffixStart);
    }

    startWith = startWith.substring(0, MAX_ITEM_NAME_LENGTH - MAX_COPY_SUFFIX_LENGTH);

    if (parentItem) {
      siblings = await this.itemRepository.getChildrenNames(db, parentItem, {
        startWith,
      });
    } else {
      siblings = await this.itemMembershipRepository.getAccessibleItemNames(db, member, {
        startWith,
      });
    }

    const { copyRoot, treeCopyMap } = await this.itemRepository.copy(
      db,
      item,
      member,
      siblings,
      parentItem,
    );

    // create a membership if needed
    await this.itemMembershipRepository
      .addOne(db, {
        itemPath: copyRoot.path,
        accountId: member.id,
        creatorId: member.id,
        permission: PermissionLevel.Admin,
      })
      .catch((e) => {
        // admin permission already exists and does not need to be added
        if (e instanceof InvalidMembership) {
          return;
        }
        throw e;
      });

    // post hook
    for (const { original, copy } of treeCopyMap.values()) {
      await this.hooks.runPostHooks('copy', member, db, {
        original,
        copy,
      });

      // copy hidden visibility
      await this.itemVisibilityRepository.copyAll(db, member, original, copy.path, [
        ItemVisibilityType.Public,
      ]);

      // copy geolocation
      await this.itemGeolocationRepository.copy(db, original, copy);
      // copy thumbnails if original has setting to true
      if (original.settings.hasThumbnail) {
        try {
          // try to copy thumbnails, this might fail, so we wrap in a try-catch
          await this.thumbnailService.copyFolder(member, {
            originalId: original.id,
            newId: copy.id,
          });
        } catch {
          this.log.error(`On item copy, thumbnail for ${original.id} could not be found.`);
        }
      }
    }

    // index copied root if copied in a published item
    if (parentItem) {
      const published = await this.itemPublishedRepository.getForItem(db, parentItem.path);
      if (published) {
        await this.meilisearchWrapper.indexOne(db, published);
      }
    }

    return { item, copy: copyRoot };
  }

  // TODO: optimize
  async copyMany(
    db: DBConnection,
    member: MinimalMember,
    itemIds: string[],
    args: { parentId?: UUID },
  ) {
    let parentItem: FolderItem | undefined;
    if (args.parentId) {
      parentItem = (await this.basicItemService.get(
        db,
        member,
        args.parentId,
        PermissionLevel.Write,
      )) as FolderItem;
    }

    const results = await Promise.all(itemIds.map((id) => this.copy(db, member, id, parentItem)));

    // rescale order because copies happen in parallel
    if (parentItem) {
      await this.itemRepository.rescaleOrder(db, member, parentItem);
    }

    return {
      items: results.map(({ item }) => item),
      copies: results.map(({ copy }) => copy),
    };
  }

  async reorder(
    db: DBConnection,
    actor: MinimalMember,
    itemId: string,
    body: { previousItemId?: string },
  ) {
    const item = await this.basicItemService.get(db, actor, itemId);

    const ids = getIdsFromPath(item.path);

    // cannot reorder root item
    if (ids.length <= 1) {
      throw new CannotReorderRootItem(item.id);
    }

    const parentPath = buildPathFromIds(...ids.slice(0, -1));

    return this.itemRepository.reorder(db, item, parentPath, body.previousItemId);
  }

  /**
   * Rescale order of children (of itemId's parent) if necessary
   * @param member
   * @param itemId item whose parent get its children order rescaled if necessary
   */
  async rescaleOrderForParent(db: DBConnection, member: AuthenticatedUser, item: Item) {
    const parentId = getParentFromPath(item.path);
    if (parentId) {
      const parentItem = await this.basicItemService.get(db, member, parentId);
      await this.itemRepository.rescaleOrder(db, member, parentItem);
    }
  }
}
