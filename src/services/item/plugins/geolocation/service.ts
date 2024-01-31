import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { validatePermissionMany } from '../../../authorization';
import { Actor } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import ItemService from '../../service';
import { ItemGeolocation } from './ItemGeolocation';
import { ItemGeolocationNotFound } from './errors';

export class ItemGeolocationService {
  private itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async delete(actor: Actor, repositories: Repositories, itemId: Item['id']) {
    const { itemGeolocationRepository } = repositories;

    // check item exists and actor has permission
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Write);

    return itemGeolocationRepository.delete(item);
  }

  async getByItem(actor: Actor, repositories: Repositories, itemId: Item['id']) {
    const { itemGeolocationRepository } = repositories;

    // check item exists and actor has permission
    const item = await this.itemService.get(actor, repositories, itemId);

    const geoloc = await itemGeolocationRepository.getByItem(item);

    if (!geoloc) {
      throw new ItemGeolocationNotFound({ itemId: item.id });
    }

    return geoloc;
  }

  async getIn(
    actor: Actor,
    repositories: Repositories,
    query: {
      lat1: ItemGeolocation['lat'];
      lat2: ItemGeolocation['lat'];
      lng1: ItemGeolocation['lng'];
      lng2: ItemGeolocation['lng'];
      search?: string[];
    },
  ) {
    const { itemGeolocationRepository } = repositories;
    const geoloc = await itemGeolocationRepository.getItemsIn(query);
    const validatedItems = await validatePermissionMany(
      repositories,
      PermissionLevel.Read,
      actor,
      geoloc.map(({ item }) => item),
    );

    // TODO optimize?
    return geoloc.filter((g) => g.item.id in validatedItems.data);
  }

  async put(
    actor: Actor,
    repositories: Repositories,
    itemId: Item['id'],
    geolocation: Pick<ItemGeolocation, 'lat' | 'lng'>,
  ) {
    const { itemGeolocationRepository } = repositories;

    // check item exists and actor has permission
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Write);

    return itemGeolocationRepository.put(item.path, geolocation);
  }
}
