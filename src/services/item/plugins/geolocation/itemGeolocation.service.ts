import { inject, singleton } from 'tsyringe';

import { GEOLOCATION_API_KEY_DI_KEY } from '../../../../di/constants';
import { type DBConnection } from '../../../../drizzle/db';
import type { ItemGeolocationRaw } from '../../../../drizzle/types';
import type { MaybeUser, MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import type { ItemRaw } from '../../item';
import { type PackedItem, PackedItemDTO } from '../../packedItem.dto';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import { MissingGeolocationApiKey } from './errors';
import { ItemGeolocationRepository } from './itemGeolocation.repository';

export type PackedItemGeolocation = ItemGeolocationRaw & {
  item: PackedItem;
};

@singleton()
export class ItemGeolocationService {
  private readonly itemThumbnailService: ItemThumbnailService;
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly geolocationKey: string;
  private readonly itemGeolocationRepository: ItemGeolocationRepository;

  constructor(
    itemThumbnailService: ItemThumbnailService,
    authorizedItemService: AuthorizedItemService,
    itemGeolocationRepository: ItemGeolocationRepository,
    @inject(GEOLOCATION_API_KEY_DI_KEY) geolocationKey: string,
  ) {
    this.itemThumbnailService = itemThumbnailService;
    this.authorizedItemService = authorizedItemService;
    this.itemGeolocationRepository = itemGeolocationRepository;
    this.geolocationKey = geolocationKey;
  }

  async delete(dbConnection: DBConnection, member: MinimalMember, itemId: ItemRaw['id']) {
    // check item exists and actor has permission
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: member.id,
      itemId,
      permission: 'write',
    });

    return this.itemGeolocationRepository.delete(dbConnection, item);
  }

  async getByItem(dbConnection: DBConnection, maybeUser: MaybeUser, itemId: ItemRaw['id']) {
    // check item exists and actor has permission
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });

    const geoloc = await this.itemGeolocationRepository.getByItem(dbConnection, item.path);

    return geoloc;
  }

  async getIn(
    dbConnection: DBConnection,
    maybeUser: MaybeUser,
    query: {
      parentItemId?: ItemRaw['id'];
      lat1?: ItemGeolocationRaw['lat'];
      lat2?: ItemGeolocationRaw['lat'];
      lng1?: ItemGeolocationRaw['lng'];
      lng2?: ItemGeolocationRaw['lng'];
      keywords?: string[];
    },
  ): Promise<PackedItemGeolocation[]> {
    let parentItem: ItemRaw | undefined;
    if (query.parentItemId) {
      parentItem = await this.authorizedItemService.getItemById(dbConnection, {
        accountId: maybeUser?.id,
        itemId: query.parentItemId,
      });
    }

    const geoloc = await this.itemGeolocationRepository.getItemsIn(
      dbConnection,
      maybeUser,
      query,
      parentItem,
    );

    // check if there are any items with a geolocation, if not return early
    const itemsWithGeoloc = geoloc.map(({ item }) => item);
    if (!itemsWithGeoloc.length) {
      return [];
    }

    const { itemMemberships, visibilities } =
      await this.authorizedItemService.getPropertiesForItems(dbConnection, {
        permission: 'read',
        accountId: maybeUser?.id,
        items: geoloc.map(({ item }) => item),
      });

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
          const newItem = new PackedItemDTO(
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
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: ItemRaw['id'],
    geolocation: Pick<ItemGeolocationRaw, 'lat' | 'lng'> &
      Pick<Partial<ItemGeolocationRaw>, 'addressLabel' | 'helperLabel'>,
  ) {
    // check item exists and member has permission
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: member.id,
      itemId,
      permission: 'write',
    });

    return this.itemGeolocationRepository.put(dbConnection, item.path, geolocation);
  }

  async getAddressFromCoordinates(
    query: Pick<ItemGeolocationRaw, 'lat' | 'lng'> & { lang?: string },
  ) {
    if (!this.geolocationKey) {
      throw new MissingGeolocationApiKey();
    }

    return this.itemGeolocationRepository.getAddressFromCoordinates(query, this.geolocationKey);
  }

  async getSuggestionsForQuery(query: { query: string; lang?: string }) {
    if (!this.geolocationKey) {
      throw new MissingGeolocationApiKey();
    }

    return this.itemGeolocationRepository.getSuggestionsForQuery(query, this.geolocationKey);
  }
}
