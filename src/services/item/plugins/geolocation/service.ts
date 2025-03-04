import { inject, singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { GEOLOCATION_API_KEY_DI_KEY } from '../../../../di/constants';
import { DBConnection } from '../../../../drizzle/db';
import { Item } from '../../../../drizzle/types';
import { MaybeUser, MinimalMember } from '../../../../types';
import { AuthorizationService } from '../../../authorization';
import { ItemWrapper } from '../../ItemWrapper';
import { ItemService } from '../../service';
import { ItemThumbnailService } from '../thumbnail/service';
import { ItemGeolocation, PackedItemGeolocation } from './ItemGeolocation';
import { MissingGeolocationApiKey } from './errors';
import { ItemGeolocationRepository } from './repository';

@singleton()
export class ItemGeolocationService {
  private readonly itemService: ItemService;
  private readonly itemThumbnailService: ItemThumbnailService;
  private readonly authorizationService: AuthorizationService;
  private readonly geolocationKey: string;
  private readonly itemGeolocationRepository: ItemGeolocationRepository;

  constructor(
    itemService: ItemService,
    itemThumbnailService: ItemThumbnailService,
    authorizationService: AuthorizationService,
    itemGeolocationRepository: ItemGeolocationRepository,
    @inject(GEOLOCATION_API_KEY_DI_KEY) geolocationKey: string,
  ) {
    this.itemService = itemService;
    this.itemThumbnailService = itemThumbnailService;
    this.authorizationService = authorizationService;
    this.itemGeolocationRepository = itemGeolocationRepository;
    this.geolocationKey = geolocationKey;
  }

  async delete(db: DBConnection, member: MinimalMember, itemId: Item['id']) {
    // check item exists and actor has permission
    const item = await this.itemService.get(db, member, itemId, PermissionLevel.Write);

    return this.itemGeolocationRepository.delete(db, item);
  }

  async getByItem(
    db: DBConnection,
    actor: MaybeUser,
    itemId: Item['id'],
  ): Promise<PackedItemGeolocation | null> {
    // check item exists and actor has permission
    const item = await this.itemService.get(db, actor, itemId);

    const geoloc = await this.itemGeolocationRepository.getByItem(db, item.path);

    if (geoloc) {
      // return packed item of related item (could be parent)
      const geolocPackedItem = await this.itemService.getPacked(db, actor, geoloc.item.id);
      return { ...geoloc, item: geolocPackedItem };
    }
    return null;
  }

  async getIn(
    db: DBConnection,
    actor: MaybeUser,
    query: {
      parentItemId?: Item['id'];
      lat1?: ItemGeolocation['lat'];
      lat2?: ItemGeolocation['lat'];
      lng1?: ItemGeolocation['lng'];
      lng2?: ItemGeolocation['lng'];
      keywords?: string[];
    },
  ): Promise<PackedItemGeolocation[]> {
    let parentItem: Item | undefined;
    if (query.parentItemId) {
      parentItem = await this.itemService.get(db, actor, query.parentItemId);
    }

    const geoloc = await this.itemGeolocationRepository.getItemsIn(actor, query, parentItem);

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
    geolocation: Pick<ItemGeolocation, 'lat' | 'lng'> &
      Pick<Partial<ItemGeolocation>, 'addressLabel' | 'helperLabel'>,
  ) {
    // check item exists and member has permission
    const item = await this.itemService.get(db, member, itemId, PermissionLevel.Write);

    return this.itemGeolocationRepository.put(db, item.path, geolocation);
  }

  async getAddressFromCoordinates(
    db: DBConnection,
    query: Pick<ItemGeolocation, 'lat' | 'lng'> & { lang?: string },
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
