// this is an esm module, since we are using commonjs it can have unexpected behavior
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { iso1A2Code } from '@rapideditor/country-coder';
import fetch from 'node-fetch';
import { Brackets, EntityManager } from 'typeorm';

import { DEFAULT_LANG } from '@graasp/translations';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { ALLOWED_SEARCH_LANGS, GEOLOCATION_API_HOST } from '../../../../utils/config';
import { Item } from '../../entities/Item';
import { ItemGeolocation } from './ItemGeolocation';
import { MissingGeolocationSearchParams, PartialItemGeolocation } from './errors';

export class ItemGeolocationRepository extends AbstractRepository<ItemGeolocation> {
  constructor(manager?: EntityManager) {
    super(ItemGeolocation, manager);
  }

  /**
   * copy geolocation of original item to copied item
   * @param original original item
   * @param copy copied item
   */
  async copy(original: Item, copy: Item): Promise<void> {
    const geoloc = await this.getByItem(original.path);
    if (geoloc) {
      await this.repository.insert({
        item: { path: copy.path },
        lat: geoloc.lat,
        lng: geoloc.lng,
        country: geoloc.country,
        addressLabel: geoloc.addressLabel,
        helperLabel: geoloc.helperLabel,
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
   * Returns geolocation within boundaries and/or within parentItem. At least one of the two should be defined
   * @param lat1
   * @param lat2
   * @param lng1
   * @param lng2
   * @param keywords search words
   * @param parentItem item to search within
   * @returns item geolocations within bounding box. Does not include inheritance.
   */
  async getItemsIn(
    {
      lat1,
      lat2,
      lng1,
      lng2,
      keywords,
    }: {
      lat1?: ItemGeolocation['lat'];
      lat2?: ItemGeolocation['lat'];
      lng1?: ItemGeolocation['lng'];
      lng2?: ItemGeolocation['lng'];
      keywords?: string[];
    },
    parentItem?: Item,
    memberLang?: string,
  ): Promise<ItemGeolocation[]> {
    // should include at least parentItem or all lat/lng
    if (
      !parentItem &&
      ((!lat1 && lat1 !== 0) ||
        (!lat2 && lat2 !== 0) ||
        (!lng1 && lng1 !== 0) ||
        (!lng2 && lng2 !== 0))
    ) {
      throw new MissingGeolocationSearchParams({ parentItem, lat1, lat2, lng1, lng2 });
    }

    const query = this.repository
      .createQueryBuilder('ig')
      // inner join to filter out recycled items
      .innerJoinAndSelect('ig.item', 'item')
      .leftJoinAndSelect('item.creator', 'member')
      // basic where to allow following where to be `andWhere`
      .where('item = item');

    if (
      typeof lat1 === 'number' &&
      typeof lat2 === 'number' &&
      typeof lng1 === 'number' &&
      typeof lng2 === 'number'
    ) {
      const [minLat, maxLat] = [lat1, lat2].sort((a, b) => a - b);
      const [minLng, maxLng] = [lng1, lng2].sort((a, b) => a - b);
      query
        .andWhere('lat BETWEEN :minLat AND :maxLat', { minLat, maxLat })
        .andWhere('lng BETWEEN :minLng AND :maxLng', { minLng, maxLng });
    }

    if (parentItem) {
      query.andWhere('item.path <@ :path', { path: parentItem.path });
    }

    const allKeywords = keywords?.filter((s) => s && s.length);
    if (allKeywords?.length) {
      const keywordsString = allKeywords.join(' ');
      query.andWhere(
        new Brackets((q) => {
          // search in english by default
          q.where("item.search_document @@ plainto_tsquery('english', :keywords)", {
            keywords: keywordsString,
          });

          // no dictionary
          q.orWhere("item.search_document @@ plainto_tsquery('simple', :keywords)", {
            keywords: keywordsString,
          });

          // raw words search
          allKeywords.forEach((k, idx) => {
            q.orWhere(`item.name ILIKE :k_${idx}`, {
              [`k_${idx}`]: `%${k}%`,
            });
          });

          // search by member lang if defined and not english
          if (memberLang && memberLang != 'en') {
            const memberLangKey = memberLang as keyof typeof ALLOWED_SEARCH_LANGS;

            if (ALLOWED_SEARCH_LANGS[memberLangKey]) {
              q.orWhere('item.search_document @@ plainto_tsquery(:lang, :keywords)', {
                keywords: keywordsString,
                lang: ALLOWED_SEARCH_LANGS[memberLangKey],
              });
            }
          }
        }),
      );
    }

    return query.getMany();
  }

  /**
   * @param itemPath
   * @returns geolocation for this item
   */
  async getByItem(itemPath: Item['path']): Promise<ItemGeolocation | null> {
    const geoloc = await this.repository
      .createQueryBuilder('geoloc')
      .leftJoinAndSelect('geoloc.item', 'item')
      .where('item.path @> :path', { path: itemPath })
      .orderBy('geoloc.item_path', 'DESC')
      .limit(1)
      .getOne();

    return geoloc;
  }

  /**
   * Add or update geolocation given item path
   * deduce country based on lat and lng
   * @param itemPath
   * @param geolocation lat and lng values, optional addressLabel
   */
  async put(
    itemPath: Item['path'],
    geolocation: Pick<ItemGeolocation, 'lat' | 'lng'> &
      Pick<Partial<ItemGeolocation>, 'addressLabel' | 'helperLabel'>,
  ): Promise<void> {
    // lat and lng should exist together
    const { lat, lng } = geolocation || {};
    if ((lat && !lng) || (lng && !lat)) {
      throw new PartialItemGeolocation({ lat, lng });
    }

    // country might not exist because the point is outside borders
    const country = iso1A2Code([geolocation.lng, geolocation.lat]);

    await this.repository.upsert(
      [
        {
          item: { path: itemPath },
          lat: geolocation.lat,
          lng: geolocation.lng,
          addressLabel: geolocation.addressLabel,
          helperLabel: geolocation.helperLabel,
          country,
        },
      ],
      ['item'],
    );
  }

  async getAddressFromCoordinates(
    { lat, lng, lang = DEFAULT_LANG }: Pick<ItemGeolocation, 'lat' | 'lng'> & { lang?: string },
    key: string,
  ) {
    const searchParams = new URLSearchParams({
      apiKey: key,
      lat: lat.toString(),
      lon: lng.toString(),
      format: 'json',
      lang,
    });
    const { results } = await fetch(
      `${GEOLOCATION_API_HOST}/reverse?${searchParams.toString()}`,
    ).then((r) => {
      return r.json();
    });
    return { addressLabel: results[0].formatted, country: results[0].country };
  }

  async getSuggestionsForQuery(
    { query, lang = DEFAULT_LANG }: { query: string; lang?: string },
    key: string,
  ): Promise<
    [
      {
        id: string;
        addressLabel: string;
        country: string;
        lat: number;
        lng: number;
      },
    ]
  > {
    const searchParams = new URLSearchParams({
      text: query,
      format: 'json',
      apiKey: key,
      lang,
    });

    const { results } = await fetch(
      `${GEOLOCATION_API_HOST}/search?${searchParams.toString()}`,
    ).then((r) => r.json());

    return results.map((r) => ({
      addressLabel: r.formatted,
      country: r.country_code,
      id: r.place_id,
      lat: r.lat,
      lng: r.lon,
    }));
  }
}
