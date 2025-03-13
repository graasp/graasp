import { inject, singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { GEOLOCATION_API_KEY_DI_KEY } from '../../../../di/constants';
import { DBConnection } from '../../../../drizzle/db';
import { Item, ItemGeolocationRaw } from '../../../../drizzle/types';
import { MaybeUser, MinimalMember } from '../../../../types';
import { AuthorizationService } from '../../../authorization';
import { ItemWrapper, type PackedItem } from '../../ItemWrapper';
import { BasicItemService } from '../../basic.service';
import { ItemThumbnailService } from '../thumbnail/service';
import { MissingGeolocationApiKey } from './errors';
import { ItemGeolocationRepository } from './geolocation.repository';

type PackedItemGeolocation = ItemGeolocationRaw & {
  item: PackedItem;
};

@singleton()
export class ItemGeolocationService {
  private readonly basicItemService: BasicItemService;
  private readonly itemThumbnailService: ItemThumbnailService;
  private readonly authorizationService: AuthorizationService;
  private readonly geolocationKey: string;
  private readonly itemGeolocationRepository: ItemGeolocationRepository;

  constructor(
    basicItemService: BasicItemService,
    itemThumbnailService: ItemThumbnailService,
    authorizationService: AuthorizationService,
    itemGeolocationRepository: ItemGeolocationRepository,
    @inject(GEOLOCATION_API_KEY_DI_KEY) geolocationKey: string,
  ) {
    this.basicItemService = basicItemService;
    this.itemThumbnailService = itemThumbnailService;
    this.authorizationService = authorizationService;
    this.itemGeolocationRepository = itemGeolocationRepository;
    this.geolocationKey = geolocationKey;
  }

  async delete(db: DBConnection, member: MinimalMember, itemId: Item['id']) {
    // check item exists and actor has permission
    const item = await this.basicItemService.get(db, member, itemId, PermissionLevel.Write);

    return this.itemGeolocationRepository.delete(db, item);
  }

  async getByItem(db: DBConnection, actor: MaybeUser, itemId: Item['id']) {
    // check item exists and actor has permission
    const item = await this.basicItemService.get(db, actor, itemId);

    const geoloc = await this.itemGeolocationRepository.getByItem(db, item.path);

    return geoloc;
  }

  async getIn(
    db: DBConnection,
    actor: MaybeUser,
    query: {
      parentItemId?: Item['id'];
      lat1?: ItemGeolocationRaw['lat'];
      lat2?: ItemGeolocationRaw['lat'];
      lng1?: ItemGeolocationRaw['lng'];
      lng2?: ItemGeolocationRaw['lng'];
      keywords?: string[];
    },
  ): Promise<PackedItemGeolocation[]> {
    let parentItem: Item | undefined;
    if (query.parentItemId) {
      parentItem = await this.basicItemService.get(db, actor, query.parentItemId);
    }

    const geoloc = await this.itemGeolocationRepository.getItemsIn(db, actor, query, parentItem);

    // check if there are any items with a geolocation, if not return early
    const itemsWithGeoloc = geoloc.map(({ item }) => item);
    if (!itemsWithGeoloc.length) {
      return [];
    }

    const { itemMemberships, visibilities } =
      await this.authorizationService.validatePermissionMany(
        db,
        PermissionLevel.Read,
        actor,
        geoloc.map(({ item }) => item),
      );

    const thumbnailsByItem = await this.itemThumbnailService.getUrlsByItems(itemsWithGeoloc);

    // filter out items without permission
    return geoloc
      .map((g) => {
        const itemId = g.item.id;
        // accessible items - permission can be null
        // accept public items within parent item
        const itemIsAtLeastPublicOrInParent = itemId in itemMemberships.data && query.parentItemId;
        // otherwise the actor should have at least read permission on root
        const itemIsAtLeastReadable = itemMemberships.data[itemId];
        if (itemIsAtLeastPublicOrInParent || itemIsAtLeastReadable) {
          // and add permission for item packed
          // TODO optimize?
          const thumbnails = thumbnailsByItem[g.item.id];
          const newItem = new ItemWrapper(
            g.item,
            itemMemberships.data[itemId],
            visibilities.data[itemId],
            thumbnails,
          );
          return {
            ...g,
            item: newItem.packed(),
          };
        }
        return null;
      })
      .filter(Boolean) as PackedItemGeolocation[];
  }

  async put(
    db: DBConnection,
    member: MinimalMember,
    itemId: Item['id'],
    geolocation: Pick<ItemGeolocationRaw, 'lat' | 'lng'> &
      Pick<Partial<ItemGeolocationRaw>, 'addressLabel' | 'helperLabel'>,
  ) {
    // check item exists and member has permission
    const item = await this.basicItemService.get(db, member, itemId, PermissionLevel.Write);

    return this.itemGeolocationRepository.put(db, item.path, geolocation);
  }

  async getAddressFromCoordinates(
    db: DBConnection,
    query: Pick<ItemGeolocationRaw, 'lat' | 'lng'> & { lang?: string },
  ) {
    if (!this.geolocationKey) {
      throw new MissingGeolocationApiKey();
    }

    return this.itemGeolocationRepository.getAddressFromCoordinates(query, this.geolocationKey);
  }

  async getSuggestionsForQuery(db: DBConnection, query: { query: string; lang?: string }) {
    if (!this.geolocationKey) {
      throw new MissingGeolocationApiKey();
    }

    return this.itemGeolocationRepository.getSuggestionsForQuery(query, this.geolocationKey);
  }
}
