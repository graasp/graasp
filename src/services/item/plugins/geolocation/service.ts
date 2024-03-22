import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { validatePermissionMany } from '../../../authorization';
import { Actor, Member } from '../../../member/entities/member';
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
    const packedItem = await this.itemService.getPacked(actor, repositories, itemId);

    const geoloc = await itemGeolocationRepository.getByItem(packedItem.path);

    if (geoloc) {
      // add permission for item packed
      return { ...geoloc, item: packedItem };
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
    const validatedItems = await validatePermissionMany(
      repositories,
      PermissionLevel.Read,
      actor,
      geoloc.map(({ item }) => item),
    );

    // filter out items without permission
    // and add permission for item packed
    // TODO optimize?
    const memberships = validatedItems.data;
    return geoloc
      .map((g) => {
        if (g.item.id in validatedItems.data) {
          return {
            ...g,
            item: { ...g.item, permission: memberships[g.item.id]?.permission ?? null },
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
      Pick<Partial<ItemGeolocation>, 'addressLabel'>,
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
