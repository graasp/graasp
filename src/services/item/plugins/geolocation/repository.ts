import { iso1A2Code } from '@rapideditor/country-coder';
import { Between, EntityManager, Repository } from 'typeorm';

import { AppDataSource } from '../../../../plugins/datasource';
import { Item } from '../../entities/Item';
import { ItemGeolocation } from './ItemGeolocation';

export class ItemGeolocationRepository {
  private repository: Repository<ItemGeolocation>;

  constructor(manager?: EntityManager) {
    if (manager) {
      this.repository = manager.getRepository(ItemGeolocation);
    } else {
      this.repository = AppDataSource.getRepository(ItemGeolocation);
    }
  }

  async getForItem(item: Item): Promise<ItemGeolocation | null> {
    const geoloc = await this.repository
      .createQueryBuilder('geoloc')
      .leftJoinAndSelect('geoloc.item', 'item')
      .where('geoloc.item_path @> :path', { path: item.path })
      .orderBy('geoloc.item_path', 'DESC')
      .limit(1)
      .getOne();

    return geoloc;
  }

  async getItemsIn(
    lat1: number,
    lat2: number,
    lng1: number,
    lng2: number,
  ): Promise<ItemGeolocation[]> {
    const geoloc = await this.repository.find({
      where: {
        lat: Between(lat1, lat2),
        lng: Between(lng1, lng2),
      },
      relations: { item: true },
    });

    return geoloc;
  }

  async put(itemPath: Item['path'], lat: number, lng: number): Promise<void> {
    // if cannot find country, lat and lng are incorrect
    const country = iso1A2Code([lat, lng]);

    if (!country) {
      throw new Error();
    }

    await this.repository.insert({
      item: { path: itemPath },
      lat,
      lng,
      country,
    });
  }

  async copy(original: Item, copy: Item): Promise<void> {
    const geoloc = await this.getForItem(original);
    if (geoloc) {
      await this.repository.insert({
        item: { path: copy.path },
        lat: geoloc.lat,
        lng: geoloc.lng,
        country: geoloc.country,
      });
    }
  }

  async delete(item: Item): Promise<void> {
    await this.repository.delete({ item: { path: item.path } });
  }
}
