// this is an esm module, since we are using commonjs it can have unexpected behavior
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error esm module
import { iso1A2Code } from '@rapideditor/country-coder';
import { SQL, and, between, desc, eq, or } from 'drizzle-orm';
import fetch from 'node-fetch';

import { DEFAULT_LANG } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import {
  isAncestorOrSelf,
  isDescendantOrSelf,
  itemFullTextSearch,
  keywordSearch,
  tagSearch,
  transformLangToReconfigLang,
} from '../../../../drizzle/operations';
import { accountsTable, itemGeolocationsTable, items } from '../../../../drizzle/schema';
import type {
  ItemGeolocationRaw,
  ItemGeolocationWithItem,
  ItemGeolocationWithItemWithCreator,
  MemberRaw,
} from '../../../../drizzle/types';
import type { MaybeUser } from '../../../../types';
import { GEOLOCATION_API_HOST, getSearchLang } from '../../../../utils/config';
import { isMember } from '../../../authentication';
import { type ItemRaw, resolveItemType } from '../../item';
import { MissingGeolocationSearchParams, PartialItemGeolocation } from './errors';

export class ItemGeolocationRepository {
  /**
   * copy geolocation of original item to copied item
   * @param original original item
   * @param copy copied item
   */
  async copy(
    dbConnection: DBConnection,
    original: { path: ItemRaw['path'] },
    copy: { path: ItemRaw['path'] },
  ): Promise<void> {
    const geoloc = await this.getByItem(dbConnection, original.path);
    if (geoloc) {
      await dbConnection.insert(itemGeolocationsTable).values({
        itemPath: copy.path,
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
  async delete(dbConnection: DBConnection, item: ItemRaw): Promise<void> {
    await dbConnection
      .delete(itemGeolocationsTable)
      .where(eq(itemGeolocationsTable.itemPath, item.path));
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
    dbConnection: DBConnection,
    actor: MaybeUser,
    {
      lat1,
      lat2,
      lng1,
      lng2,
      keywords,
    }: {
      lat1?: ItemGeolocationRaw['lat'];
      lat2?: ItemGeolocationRaw['lat'];
      lng1?: ItemGeolocationRaw['lng'];
      lng2?: ItemGeolocationRaw['lng'];
      keywords?: string[];
    },
    parentItem?: ItemRaw,
  ): Promise<ItemGeolocationWithItemWithCreator[]> {
    // should include at least parentItem or all lat/lng
    if (
      !parentItem &&
      ((!lat1 && lat1 !== 0) ||
        (!lat2 && lat2 !== 0) ||
        (!lng1 && lng1 !== 0) ||
        (!lng2 && lng2 !== 0))
    ) {
      throw new MissingGeolocationSearchParams({
        parentItem,
        lat1,
        lat2,
        lng1,
        lng2,
      });
    }

    // reunite where conditions
    // is direct child
    const andConditions: (SQL | undefined)[] = [];

    if (
      typeof lat1 === 'number' &&
      typeof lat2 === 'number' &&
      typeof lng1 === 'number' &&
      typeof lng2 === 'number'
    ) {
      const [minLat, maxLat] = [lat1, lat2].sort((a, b) => a - b);
      const [minLng, maxLng] = [lng1, lng2].sort((a, b) => a - b);
      andConditions.push(
        between(itemGeolocationsTable.lat, minLat, maxLat),
        between(itemGeolocationsTable.lng, minLng, maxLng),
      );
    }

    if (parentItem) {
      andConditions.push(isDescendantOrSelf(items.path, parentItem.path));
    }

    // keyword search
    const allKeywords = keywords?.filter((s) => s && s.length);
    if (allKeywords && allKeywords.length) {
      const keywordsString = allKeywords.join(' ');

      // gather distinct involved languages, from actor and item
      const memberLang = actor && isMember(actor) && actor.lang ? actor.lang : DEFAULT_LANG;
      const langs = ['simple', transformLangToReconfigLang(items.lang), getSearchLang(memberLang)];

      andConditions.push(
        or(
          // search with involved languages
          ...langs.map((l) => itemFullTextSearch(items, l, keywordsString)),
          // raw words search
          ...keywordSearch(items.name, allKeywords),
          tagSearch(dbConnection, items.id, allKeywords),
        ),
      );
    }

    const result = await dbConnection
      .select()
      .from(itemGeolocationsTable)
      // use view to filter out recycled items
      .innerJoin(items, eq(items.path, itemGeolocationsTable.itemPath))
      .leftJoin(accountsTable, eq(items.creatorId, accountsTable.id))
      .where(and(...andConditions));

    return result.map(({ item_view, account, item_geolocation }) => ({
      ...item_geolocation,
      item: { ...resolveItemType(item_view), creator: account as MemberRaw },
    }));
  }

  /**
   * @param itemPath
   * @returns geolocation for this item
   */
  async getByItem(
    dbConnection: DBConnection,
    itemPath: ItemRaw['path'],
  ): Promise<ItemGeolocationWithItem | undefined> {
    const geoloc = await dbConnection.query.itemGeolocationsTable.findFirst({
      where: isAncestorOrSelf(itemGeolocationsTable.itemPath, itemPath),
      with: { item: true },
      orderBy: desc(itemGeolocationsTable.itemPath),
    });

    return geoloc;
  }

  /**
   * Add or update geolocation given item path
   * deduce country based on lat and lng
   * @param itemPath
   * @param geolocation lat and lng values, optional addressLabel
   */
  async put(
    dbConnection: DBConnection,
    itemPath: ItemRaw['path'],
    geolocation: Pick<ItemGeolocationRaw, 'lat' | 'lng'> &
      Pick<Partial<ItemGeolocationRaw>, 'addressLabel' | 'helperLabel'>,
  ): Promise<void> {
    // lat and lng should exist together
    const { lat, lng } = geolocation || {};
    if ((lat && !lng) || (lng && !lat)) {
      throw new PartialItemGeolocation({ lat, lng });
    }

    // country might not exist because the point is outside borders
    const country = iso1A2Code([geolocation.lng, geolocation.lat]);

    await dbConnection
      .insert(itemGeolocationsTable)
      .values({
        itemPath,
        lat: geolocation.lat,
        lng: geolocation.lng,
        addressLabel: geolocation.addressLabel,
        helperLabel: geolocation.helperLabel,
        country,
      })
      .onConflictDoUpdate({
        target: itemGeolocationsTable.itemPath,
        targetWhere: eq(itemGeolocationsTable.itemPath, itemPath),
        set: {
          lat: geolocation.lat,
          lng: geolocation.lng,
          addressLabel: geolocation.addressLabel,
          helperLabel: geolocation.helperLabel,
          country,
        },
      });
  }

  async getAddressFromCoordinates(
    { lat, lng, lang = DEFAULT_LANG }: Pick<ItemGeolocationRaw, 'lat' | 'lng'> & { lang?: string },
    key: string,
  ): Promise<{ addressLabel: string; country: string }> {
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

    return results.map(
      (r: {
        formatted: string;
        country_code: string;
        place_id: string;
        lat: string;
        lon: string;
      }) => ({
        addressLabel: r.formatted,
        country: r.country_code,
        id: r.place_id,
        lat: r.lat,
        lng: r.lon,
      }),
    );
  }
}
