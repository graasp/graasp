import { iso1A2Code } from '@rapideditor/country-coder';
import { EntityManager, Repository } from 'typeorm';

import { AppDataSource } from '../../../../plugins/datasource';
import { ALLOWED_SEARCH_LANGS } from '../../../../utils/config';
import { Actor } from '../../../member/entities/member';
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

  /**
   * copy geolocation of original item to copied item
   * @param original original item
   * @param copy copied item
   */
  async copy(original: Item, copy: Item): Promise<void> {
    const geoloc = await this.getByItem(original);
    if (geoloc) {
      await this.repository.insert({
        item: { path: copy.path },
        lat: geoloc.lat,
        lng: geoloc.lng,
        country: geoloc.country,
      });
    }
  }

  /**
   * Delete a geolocation given an item
   * @param item item to delete
   */
  async delete(item: Item): Promise<void> {
    await this.repository.delete({ item: { path: item.path } });
  }

  /**
   * @param lat1
   * @param lat2
   * @param lng1
   * @param lng2
   * @returns item geolocations within bounding box. Does not include inheritance.
   */
  async getItemsIn(
    actor: Actor,
    {
      lat1,
      lat2,
      lng1,
      lng2,
      keywords,
    }: {
      lat1: ItemGeolocation['lat'];
      lat2: ItemGeolocation['lat'];
      lng1: ItemGeolocation['lng'];
      lng2: ItemGeolocation['lng'];
      keywords?: string[];
    },
  ): Promise<ItemGeolocation[]> {
    const [minLat, maxLat] = [lat1, lat2].sort((a, b) => a - b);
    const [minLng, maxLng] = [lng1, lng2].sort((a, b) => a - b);

    const geoloc = this.repository
      .createQueryBuilder('ig')
      .leftJoinAndSelect('ig.item', 'item')
      .leftJoinAndSelect('item.creator', 'member')
      .where('lat BETWEEN :minLat AND :maxLat', { minLat, maxLat })
      .andWhere('lng BETWEEN :minLng AND :maxLng', { minLng, maxLng });

    if (keywords?.filter((s) => s.length)?.length) {
      const keywordsString = keywords.join(' ');
      const memberLang = actor?.lang;
      geoloc.andWhere((q) => {
        // search in english by default
        q.where("item.search_document @@ plainto_tsquery('english', :keywords)", {
          keywords: keywordsString,
        });

        // search by member lang
        if (memberLang && memberLang != 'en' && ALLOWED_SEARCH_LANGS[memberLang]) {
          q.orWhere('item.search_document @@ plainto_tsquery(:lang, :keywords)', {
            keywords: keywordsString,
            lang: ALLOWED_SEARCH_LANGS[memberLang],
          });
        }
      });
    }

    return geoloc.getMany();
  }

  /**
   * @param item
   * @returns geolocation for this item
   */
  async getByItem(item: Item): Promise<ItemGeolocation | null> {
    const geoloc = await this.repository
      .createQueryBuilder('geoloc')
      .where('geoloc.item_path @> :path', { path: item.path })
      .orderBy('geoloc.item_path', 'DESC')
      .limit(1)
      .getOne();

    return geoloc;
  }

  /**
   * Add or update geolocation given item path
   * deduce country based on lat and lng
   * @param itemPath
   * @param geolocation lat and lng values
   */
  async put(
    itemPath: Item['path'],

    geolocation: Pick<ItemGeolocation, 'lat' | 'lng'>,
  ): Promise<void> {
    // if cannot find country, lat and lng are incorrect
    const country = iso1A2Code([geolocation.lat, geolocation.lng]);

    await this.repository.upsert(
      [
        {
          item: { path: itemPath },
          lat: geolocation.lat,
          lng: geolocation.lng,
          country,
        },
      ],
      ['item'],
    );
  }
}
