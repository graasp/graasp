import { StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';

import { HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { AppDataSource } from '../../../../plugins/datasource';
import { ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { MemberCannotAccess } from '../../../../utils/errors';
import { saveItemAndMembership } from '../../../itemMembership/test/fixtures/memberships';
import { BOB, saveMember } from '../../../member/test/fixtures/members';
import { getDummyItem, savePublicItem } from '../../test/fixtures/items';
import { ItemGeolocation } from './ItemGeolocation';
import { ItemGeolocationNotFound } from './errors';

// mock datasource
jest.mock('../../../../plugins/datasource');

const repository = AppDataSource.getRepository(ItemGeolocation);

const expectItemGeolocations = (results: ItemGeolocation[], expected: ItemGeolocation[]) => {
  for (const ig of expected) {
    expect(results).toContainEqual(
      expect.objectContaining({
        lat: ig.lat,
        lng: ig.lng,
        item: expect.objectContaining({
          id: ig.item.id,
          creator: expect.objectContaining({ id: ig.item.creator!.id }),
        }),
      }),
    );
  }
};

describe('Item Geolocation', () => {
  let app;
  let actor;
  let item;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    item = null;
    app.close();
  });

  describe('GET /:id/geolocation', () => {
    describe('Signed out', () => {
      it('Get geolocation for public item', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember(BOB);
        item = await savePublicItem({ actor: member, item: getDummyItem() });
        const geoloc = await repository.save({ item, lat: 1, lng: 2, country: 'de' });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject({
          lat: geoloc.lat,
          lng: geoloc.lng,
          country: geoloc.country,
        });
      });
      it('Throws for non public item', async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember(BOB);
        ({ item } = await saveItemAndMembership({ member }));
        await repository.save({ item, lat: 1, lng: 2, country: 'de' });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(res.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });
    describe('Signed in', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item } = await saveItemAndMembership({ member: actor }));
      });

      it('Get geolocation', async () => {
        const geoloc = await repository.save({ item, lat: 1, lng: 2, country: 'de' });
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject({
          lat: geoloc.lat,
          lng: geoloc.lng,
          country: geoloc.country,
        });
      });

      it('Get geolocation without country', async () => {
        const geoloc = await repository.save({ item, lat: 1, lng: 2, country: null });
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject({
          lat: geoloc.lat,
          lng: geoloc.lng,
          country: null,
        });
      });

      it('Throws if no geolocation', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
        expect(res.json()).toMatchObject(new ItemGeolocationNotFound(expect.anything()));
      });

      it('Throws if id is not a uuid', async () => {
        const res = await app.inject({
          method: HttpMethod.GET,
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
        const member = await saveMember(BOB);
        const item1 = await savePublicItem({ actor: member });
        const geoloc1 = await repository.save({ item: item1, lat: 1, lng: 2, country: 'de' });
        const item2 = await savePublicItem({ actor: member });
        const geoloc2 = await repository.save({ item: item2, lat: 1, lng: 2, country: 'de' });
        const item3 = await savePublicItem({ actor: member });
        const geoloc3 = await repository.save({ item: item3, lat: 1, lng: 2, country: 'de' });

        const res = await app.inject({
          method: HttpMethod.GET,
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
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat2=1&lng1=1&lng2`,
        });
        expect(res1.statusCode).toBe(StatusCodes.BAD_REQUEST);
        // missing lat2
        const res2 = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lng1=1&lng2=1`,
        });
        expect(res2.statusCode).toBe(StatusCodes.BAD_REQUEST);
        // missing lng1
        const res3 = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng2=1`,
        });
        expect(res3.statusCode).toBe(StatusCodes.BAD_REQUEST);
        // missing lng2
        const res4 = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1`,
        });
        expect(res4.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Get item geolocations', async () => {
        const { item: item1 } = await saveItemAndMembership({ member: actor });
        const geoloc1 = await repository.save({ item: item1, lat: 1, lng: 2, country: 'de' });
        const { item: item2 } = await saveItemAndMembership({ member: actor });
        const geoloc2 = await repository.save({ item: item2, lat: 1, lng: 2, country: 'de' });
        const { item: item3 } = await saveItemAndMembership({ member: actor });
        const geoloc3 = await repository.save({ item: item3, lat: 1, lng: 2, country: 'de' });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1&lng2=2`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toHaveLength(3);
        expectItemGeolocations(res.json(), [geoloc1, geoloc2, geoloc3]);
      });

      it('Get item geolocations with search strings', async () => {
        const { item: item1 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'hello bye' }),
          member: actor,
        });
        const geoloc1 = await repository.save({ item: item1, lat: 1, lng: 2, country: 'de' });
        const { item: item2 } = await saveItemAndMembership({
          item: getDummyItem({ description: 'hello bye' }),
          member: actor,
        });
        const geoloc2 = await repository.save({ item: item2, lat: 1, lng: 2, country: 'de' });
        const { item: item3 } = await saveItemAndMembership({
          item: getDummyItem({ name: 'bye hello' }),
          member: actor,
        });
        const geoloc3 = await repository.save({ item: item3, lat: 1, lng: 2, country: 'de' });

        const res = await app.inject({
          method: HttpMethod.GET,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1&lng2=2&keywords=hello&keywords=bye`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toHaveLength(3);
        expectItemGeolocations(res.json(), [geoloc1, geoloc2, geoloc3]);
      });
    });
  });

  describe('PUT /:id/geolocation', () => {
    describe('Signed out', () => {
      it('Throw', async () => {
        ({ app } = await build({ member: null }));
        const res = await app.inject({
          method: HttpMethod.PUT,
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
          method: HttpMethod.PUT,
          url: `${ITEMS_ROUTE_PREFIX}/uuid/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('throw for no geolocation', async () => {
        const res = await app.inject({
          method: HttpMethod.PUT,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/geolocation`,
          body: {},
        });
      });
      it('throw for invalid lat or lng', async () => {
        const res = await app.inject({
          method: HttpMethod.PUT,
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
          method: HttpMethod.PUT,
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
          method: HttpMethod.PUT,
          url: `${ITEMS_ROUTE_PREFIX}/${v4()}/geolocation`,
          body: {
            geolocation: {
              lat: 1,
            },
          },
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        const res1 = await app.inject({
          method: HttpMethod.PUT,
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
          method: HttpMethod.PUT,
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
          method: HttpMethod.DELETE,
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
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/uuid/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('delete successfully', async () => {
        const { item } = await saveItemAndMembership({ member: actor });
        await repository.save({ item, lat: 1, lng: 1 });
        const res = await app.inject({
          method: HttpMethod.DELETE,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
      });
    });
  });
});
