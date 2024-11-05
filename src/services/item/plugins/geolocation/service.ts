import { inject, singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import { GEOLOCATION_API_KEY_DI_KEY } from '../../../../di/constants';
import { Repositories } from '../../../../utils/repositories';
import { validatePermissionMany } from '../../../authorization';
import { Actor, Member } from '../../../member/entities/member';
import { ItemWrapper } from '../../ItemWrapper';
import { Item } from '../../entities/Item';
import { ItemService } from '../../service';
import { ItemThumbnailService } from '../thumbnail/service';
import { ItemGeolocation, PackedItemGeolocation } from './ItemGeolocation';
import { MissingGeolocationApiKey } from './errors';

@singleton()
export class ItemGeolocationService {
  private readonly itemService: ItemService;
  private readonly itemThumbnailService: ItemThumbnailService;
  private readonly geolocationKey: string;

  constructor(
    itemService: ItemService,
    itemThumbnailService: ItemThumbnailService,
    @inject(GEOLOCATION_API_KEY_DI_KEY) geolocationKey: string,
  ) {
    this.itemService = itemService;
    this.itemThumbnailService = itemThumbnailService;
    this.geolocationKey = geolocationKey;
  }

  async delete(member: Member, repositories: Repositories, itemId: Item['id']) {
    const { itemGeolocationRepository } = repositories;

    // check item exists and actor has permission
    const item = await this.itemService.get(member, repositories, itemId, PermissionLevel.Write);

    return itemGeolocationRepository.delete(item);
  }

  async getByItem(
    actor: Actor,
    repositories: Repositories,
    itemId: Item['id'],
  ): Promise<PackedItemGeolocation | null> {
    const { itemGeolocationRepository } = repositories;

    // check item exists and actor has permission
    const item = await this.itemService.get(actor, repositories, itemId);

    const geoloc = await itemGeolocationRepository.getByItem(item.path);

    if (geoloc) {
      // return packed item of related item (could be parent)
      const geolocPackedItem = await this.itemService.getPacked(
        actor,
        repositories,
        geoloc.item.id,
      );
      return { ...geoloc, item: geolocPackedItem };
    }
    return null;
  }

  async getIn(
    actor: Actor,
    repositories: Repositories,
    query: {
      parentItemId?: Item['id'];
      lat1?: ItemGeolocation['lat'];
      lat2?: ItemGeolocation['lat'];
      lng1?: ItemGeolocation['lng'];
      lng2?: ItemGeolocation['lng'];
      keywords?: string[];
    },
  ): Promise<PackedItemGeolocation[]> {
    const { itemGeolocationRepository } = repositories;

    let parentItem: Item | undefined;
    if (query.parentItemId) {
      parentItem = await this.itemService.get(actor, repositories, query.parentItemId);
    }

    const geoloc = await itemGeolocationRepository.getItemsIn(actor, query, parentItem);

    // check if there are any items with a geolocation, if not return early
    const itemsWithGeoloc = geoloc.map(({ item }) => item);
    if (!itemsWithGeoloc.length) {
      return [];
    }

    const { itemMemberships, visibilities } = await validatePermissionMany(
      repositories,
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
    member: Member,
    repositories: Repositories,
    itemId: Item['id'],
    geolocation: Pick<ItemGeolocation, 'lat' | 'lng'> &
      Pick<Partial<ItemGeolocation>, 'addressLabel' | 'helperLabel'>,
  ) {
    const { itemGeolocationRepository } = repositories;

    // check item exists and member has permission
    const item = await this.itemService.get(member, repositories, itemId, PermissionLevel.Write);

    return itemGeolocationRepository.put(item.path, geolocation);
  }

  async getAddressFromCoordinates(
    repositories: Repositories,
    query: Pick<ItemGeolocation, 'lat' | 'lng'> & { lang?: string },
  ) {
    if (!this.geolocationKey) {
      throw new MissingGeolocationApiKey();
    }

    const { itemGeolocationRepository } = repositories;
    return itemGeolocationRepository.getAddressFromCoordinates(query, this.geolocationKey);
  }

  async getSuggestionsForQuery(
    repositories: Repositories,
    query: { query: string; lang?: string },
  ) {
    if (!this.geolocationKey) {
      throw new MissingGeolocationApiKey();
    }

    const { itemGeolocationRepository } = repositories;
    return itemGeolocationRepository.getSuggestionsForQuery(query, this.geolocationKey);
  }
}
