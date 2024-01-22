import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { validatePermissionMany } from '../../../authorization';
import { Actor } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import ItemService from '../../service';
import { ItemGeolocationNotFound } from './errors';

export class ItemGeolocationService {
  private itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getForItem(actor: Actor, repositories: Repositories, itemId: Item['id']) {
    const { itemGeolocationRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId);

    const geoloc = await itemGeolocationRepository.getForItem(item);

    if (!geoloc) {
      throw new ItemGeolocationNotFound({ itemId: item.id });
    }

    return geoloc;
  }

  async getIn(
    actor: Actor,
    repositories: Repositories,
    { lat1, lat2, lng1, lng2 }: { lat1: number; lat2: number; lng1: number; lng2: number },
  ) {
    const { itemGeolocationRepository } = repositories;
    const geoloc = await itemGeolocationRepository.getItemsIn(lat1, lat2, lng1, lng2);

    const validatedItems = await validatePermissionMany(
      repositories,
      PermissionLevel.Read,
      actor,
      geoloc.map(({ item }) => item),
    );

    // TODO optimize?
    return geoloc.filter((g) => validatedItems.data[g.item.id]);
  }

  async postItemWithGeolocation(
    actor: Actor,
    repositories: Repositories,
    itemWithGeolocation: Partial<Item> & {
      lat: number;
      lng: number;
    },
    parentId?: Item['id'],
  ) {
    // save item and check permissions
    const item = await this.itemService.post(actor, repositories, {
      item: itemWithGeolocation,
      parentId,
    });

    // add geolocation
    await repositories.itemGeolocationRepository.put(
      item.path,
      itemWithGeolocation.lat,
      itemWithGeolocation.lng,
    );
  }

  async put(
    actor: Actor,
    repositories: Repositories,
    itemId: Item['id'],
    lat: number,
    lng: number,
  ) {
    const { itemGeolocationRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Write);

    return itemGeolocationRepository.put(item.path, lat, lng);
  }

  async delete(actor: Actor, repositories: Repositories, itemId: Item['id']) {
    const { itemGeolocationRepository } = repositories;

    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Write);

    return itemGeolocationRepository.delete(item);
  }
}
