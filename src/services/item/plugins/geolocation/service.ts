import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { validatePermissionMany } from '../../../authorization';
import { Actor, Member } from '../../../member/entities/member';
import { ItemWrapper } from '../../ItemWrapper';
import { Item } from '../../entities/Item';
import ItemService from '../../service';
import { ItemGeolocation, PackedItemGeolocation } from './ItemGeolocation';
import { MissingGeolocationApiKey } from './errors';

export class ItemGeolocationService {
  private itemService: ItemService;
  private geolocationKey?: string;

  constructor(itemService: ItemService, geolocationKey?: string) {
    this.itemService = itemService;
    this.geolocationKey = geolocationKey;
  }

  async delete(actor: Actor, repositories: Repositories, itemId: Item['id']) {
    const { itemGeolocationRepository } = repositories;

    // check item exists and actor has permission
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Write);

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
    const { itemMemberships, tags } = await validatePermissionMany(
      repositories,
      PermissionLevel.Read,
      actor,
      geoloc.map(({ item }) => item),
    );

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
          const newItem = new ItemWrapper(g.item, itemMemberships.data[itemId], tags.data[itemId]);
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
    actor: Actor,
    repositories: Repositories,
    itemId: Item['id'],
    geolocation: Pick<ItemGeolocation, 'lat' | 'lng'> &
      Pick<Partial<ItemGeolocation>, 'addressLabel' | 'helperLabel'>,
  ) {
    const { itemGeolocationRepository } = repositories;

    // check item exists and actor has permission
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Write);

    return itemGeolocationRepository.put(item.path, geolocation);
  }

  async getAddressFromCoordinates(
    member: Member,
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
    member: Member,
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
