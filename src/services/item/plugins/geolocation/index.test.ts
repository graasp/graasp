import { StatusCodes } from 'http-status-codes';
import fetch, { type Response } from 'node-fetch';
import { v4 } from 'uuid';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { AppDataSource } from '../../../../plugins/datasource';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { MemberCannotAccess } from '../../../../utils/errors';
import { saveItemAndMembership } from '../../../itemMembership/test/fixtures/memberships';
import { saveMember } from '../../../member/test/fixtures/members';
import { PackedItem } from '../../ItemWrapper';
import { expectPackedItem, savePublicItem } from '../../test/fixtures/items';
import { ItemGeolocation, PackedItemGeolocation } from './ItemGeolocation';

jest.mock('node-fetch');

// mock datasource
jest.mock('../../../../plugins/datasource');

const repository = AppDataSource.getRepository(ItemGeolocation);

export const saveGeolocation = async (
  args: Partial<PackedItemGeolocation> & Pick<PackedItemGeolocation, 'item'>,
) => {
  const geoloc = await repository.save(args);
  return { geoloc, packed: { ...geoloc, item: args.item } };
};

export const expectItemGeolocations = (
  results: PackedItemGeolocation[],
  expected: PackedItemGeolocation[],
) => {
  for (const ig of expected) {
    expect(results).toContainEqual(
      expect.objectContaining({
        lat: ig.lat,
        lng: ig.lng,
        addressLabel: ig.addressLabel,
        country: ig.country,
        item: expect.objectContaining({
          id: ig.item.id,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          creator: expect.objectContaining({ id: ig.item.creator!.id }),
          permission: ig.item.permission,
        }),
      }),
    );
  }
};

describe('Item Geolocation', () => {
  let app;
  let actor;
  let item;
  let packedItem: PackedItem | null;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    packedItem = null;
    item = null;
    app.close();
  });

  describe('GET /:id/geolocation', () => {
    describe('Signed out', () => {
      it('Get geolocation for public item', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember();
        item = await savePublicItem({ actor: member });
        const geoloc = await repository.save({ item, lat: 1, lng: 2, country: 'de' });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expectItemGeolocations([result], [{ ...geoloc, item: { ...item, permission: null } }]);
      });

      it('Throws for non public item', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember();
        ({ item } = await saveItemAndMembership({ member }));
        await repository.save({ item, lat: 1, lng: 2, country: 'de' });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(res.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });
    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ packedItem, item } = await saveItemAndMembership({ member: actor }));
      });

      it('Get geolocation', async () => {
        const geoloc = await repository.save({ item, lat: 1, lng: 2, country: 'de' });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expect(result).toMatchObject({
          lat: geoloc.lat,
          lng: geoloc.lng,
          country: geoloc.country,
        });
        expectPackedItem(result.item, packedItem!);
      });

      it('Get geolocation without country', async () => {
        const geoloc = await repository.save({ item, lat: 1, lng: 2, country: null });
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expect(result).toMatchObject({
          lat: geoloc.lat,
          lng: geoloc.lng,
          country: null,
        });
        expectPackedItem(result.item, packedItem!);
      });

      it('Return null if no geolocation', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toBeNull();
      });

      it('Throws if id is not a uuid', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/not-valid/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
  describe('GET /geolocation', () => {
    describe('Signed out', () => {
      it('Get public item geolocations', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember();
        const item1 = await savePublicItem({ actor: member });
        const { packed: geoloc1 } = await saveGeolocation({
          item: { ...item1, permission: null },
          lat: 1,
          lng: 2,
          country: 'de',
        });
        const item2 = await savePublicItem({ actor: member });
        const { packed: geoloc2 } = await saveGeolocation({
          item: { ...item2, permission: null },
          lat: 1,
          lng: 2,
          country: 'de',
        });
        const item3 = await savePublicItem({ actor: member });
        const { packed: geoloc3 } = await saveGeolocation({
          item: { ...item3, permission: null },
          lat: 1,
          lng: 2,
          country: 'de',
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1&lng2=2`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toHaveLength(3);
        expectItemGeolocations(res.json(), [geoloc1, geoloc2, geoloc3]);
      });
    });

    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('throws if missing one parameter', async () => {
        // missing lat1
        const res1 = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat2=1&lng1=1&lng2`,
        });
        expect(res1.statusCode).toBe(StatusCodes.BAD_REQUEST);
        // missing lat2
        const res2 = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lng1=1&lng2=1`,
        });
        expect(res2.statusCode).toBe(StatusCodes.BAD_REQUEST);
        // missing lng1
        const res3 = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng2=1`,
        });
        expect(res3.statusCode).toBe(StatusCodes.BAD_REQUEST);
        // missing lng2
        const res4 = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1`,
        });
        expect(res4.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Get item geolocations', async () => {
        const { packedItem: item1 } = await saveItemAndMembership({ member: actor });
        const { packed: geoloc1 } = await saveGeolocation({
          item: item1,
          lat: 1,
          lng: 2,
          country: 'de',
        });
        const { packedItem: item2 } = await saveItemAndMembership({ member: actor });
        const { packed: geoloc2 } = await saveGeolocation({
          item: item2,
          lat: 1,
          lng: 2,
          country: 'de',
        });
        const { packedItem: item3 } = await saveItemAndMembership({ member: actor });
        const { packed: geoloc3 } = await saveGeolocation({
          item: item3,
          lat: 1,
          lng: 2,
          country: 'de',
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1&lng2=2`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toHaveLength(3);
        expectItemGeolocations(res.json(), [geoloc1, geoloc2, geoloc3]);
      });

      it('Get item geolocations with search strings', async () => {
        const { packedItem: item1 } = await saveItemAndMembership({
          item: { name: 'hello bye' },
          member: actor,
        });
        const { packed: geoloc1 } = await saveGeolocation({
          item: item1,
          lat: 1,
          lng: 2,
          country: 'de',
        });
        const { packedItem: item2 } = await saveItemAndMembership({
          item: { description: 'hello bye' },
          member: actor,
        });
        const { packed: geoloc2 } = await saveGeolocation({
          item: item2,
          lat: 1,
          lng: 2,
          country: 'de',
        });
        const { packedItem: item3 } = await saveItemAndMembership({
          item: { name: 'bye hello' },
          member: actor,
        });
        const { packed: geoloc3 } = await saveGeolocation({
          item: item3,
          lat: 1,
          lng: 2,
          country: 'de',
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1&lng2=2&keywords=hello&keywords=bye`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toHaveLength(3);
        expectItemGeolocations(res.json(), [geoloc1, geoloc2, geoloc3]);
      });

      it('Get item geolocations within parent item', async () => {
        const { item: parentItem } = await saveItemAndMembership({ member: actor });
        const { packedItem: item1 } = await saveItemAndMembership({
          item: { name: 'hello bye' },
          member: actor,
          parentItem,
        });
        const { packed: geoloc1 } = await saveGeolocation({
          item: item1,
          lat: 1,
          lng: 2,
          country: 'de',
        });
        const { packedItem: item2 } = await saveItemAndMembership({
          item: { description: 'hello bye' },
          member: actor,
          parentItem,
        });
        const { packed: geoloc2 } = await saveGeolocation({
          item: item2,
          lat: 1,
          lng: 2,
          country: 'de',
        });
        const { packedItem: item3 } = await saveItemAndMembership({
          item: { name: 'bye hello' },
          member: actor,
        });
        await saveGeolocation({ item: item3, lat: 1, lng: 2, country: 'de' });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?parentItemId=${parentItem.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toHaveLength(2);
        expectItemGeolocations(res.json(), [geoloc1, geoloc2]);
      });

      it('Throw for incorrect parent item id', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1&lng2=2&parentItemId=incorrect-id`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Throw if no parent item id and no lat lng', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('PUT /:id/geolocation', () => {
    describe('Signed out', () => {
      it('Throw', async () => {
        ({ app } = await build({ member: null }));
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/geolocation`,
          body: {
            geolocation: {
              lat: 1,
              lng: 2,
            },
          },
        });
        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });
      it('throw for invalid id', async () => {
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/uuid/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('throw for no geolocation', async () => {
        await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/geolocation`,
          body: {},
        });
      });
      it('throw for invalid lat or lng', async () => {
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/geolocation`,
          body: {
            geolocation: {
              lat: 1,
              lng: 'lng',
            },
          },
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        const res1 = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/geolocation`,
          body: {
            geolocation: {
              lat: 'lat',
              lng: 1,
            },
          },
        });
        expect(res1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('throw for missing lat or lng', async () => {
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/geolocation`,
          body: {
            geolocation: {
              lat: 1,
            },
          },
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        const res1 = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/geolocation`,
          body: {
            geolocation: {
              lng: 1,
            },
          },
        });
        expect(res1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('save successfully', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
          body: {
            geolocation: {
              lat: 2,
              lng: 1,
            },
          },
        });
        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
      });
    });
  });

  describe('DELETE /:id/geolocation', () => {
    describe('Signed out', () => {
      it('Throw', async () => {
        ({ app } = await build({ member: null }));
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });
      it('throw for invalid id', async () => {
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/uuid/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('delete successfully', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        await repository.save({ item, lat: 1, lng: 1 });
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
      });
    });
  });

  describe('GET /geolocation/reverse', () => {
    beforeEach(() => {
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {
          json: async () => ({ results: [{ formatted: 'address', country: 'country' }] }),
        } as Response;
      });
    });

    describe('Signed out', () => {
      it('Throw', async () => {
        ({ app } = await build({ member: null }));
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/reverse`,
          query: {
            lat: 2,
            lng: 2,
          },
        });

        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('get adress from coordinates', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/reverse`,
          query: {
            lat: 2,
            lng: 2,
          },
        });
        expect(res.json()).toMatchObject({ addressLabel: 'address', country: 'country' });
      });

      it('throw if missing lat', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/reverse`,
          query: {
            lng: 2,
          },
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('throw if missing lng', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/reverse`,
          query: {
            lat: 2,
          },
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('GET /geolocation/search', () => {
    beforeEach(() => {
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return {
          json: async () => ({
            results: [
              { formatted: 'address', country_code: 'country', place_id: 'id', lat: 45, lon: 23 },
              {
                formatted: 'address1',
                country_code: 'country1',
                place_id: 'id1',
                lat: 23,
                lon: 12,
              },
            ],
          }),
        } as Response;
      });
    });

    describe('Signed out', () => {
      it('Throw', async () => {
        ({ app } = await build({ member: null }));
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/search`,
          query: {
            query: 'address',
          },
        });

        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it.only('get address from search', async () => {
        (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return {
            json: async () => ({
              results: [
                { formatted: 'address', country_code: 'country', place_id: 'id', lat: 45, lon: 23 },
                {
                  formatted: 'address1',
                  country_code: 'country1',
                  place_id: 'id1',
                  lat: 23,
                  lon: 12,
                },
              ],
            }),
          } as Response;
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/search`,
          query: {
            query: 'suggestion',
          },
        });

        expect(res.json()).toMatchObject([
          {
            addressLabel: 'address',
            country: 'country',
            lat: 45,
            lng: 23,
            id: 'id',
          },
          {
            addressLabel: 'address1',
            country: 'country1',
            id: 'id1',
            lat: 23,
            lng: 12,
          },
        ]);
      });

      it('throw if missing query', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/search`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
