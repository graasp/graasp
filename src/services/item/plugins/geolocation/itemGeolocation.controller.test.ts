import { StatusCodes } from 'http-status-codes';
import nock from 'nock';
import { v4 as uuid } from 'uuid';

import type { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { assertIsDefined } from '../../../../utils/assertions';
import { GEOLOCATION_API_HOST, ITEMS_ROUTE_PREFIX } from '../../../../utils/config';
import { MemberCannotAccess } from '../../../../utils/errors';
import { assertIsMemberForTest } from '../../../authentication';
import { resolveItemType } from '../../item';
import { PackedItemDTO } from '../../packedItem.dto';
import { expectPackedItem, expectThumbnails } from '../../test/fixtures/items';
import { PackedItemGeolocation } from './itemGeolocation.service';

// Mock S3 libraries
const deleteObjectMock = jest.fn(async () => console.debug('deleteObjectMock'));
const copyObjectMock = jest.fn(async () => console.debug('copyObjectMock'));
const headObjectMock = jest.fn(async () => ({ ContentLength: 10 }));
const uploadDoneMock = jest.fn(async () => console.debug('aws s3 storage upload'));
const MOCK_SIGNED_URL = 'signed-url';

jest.mock('@aws-sdk/client-s3', () => {
  return {
    GetObjectCommand: jest.fn(),
    S3: function () {
      return {
        copyObject: copyObjectMock,
        deleteObject: deleteObjectMock,
        headObject: headObjectMock,
      };
    },
  };
});
jest.mock('@aws-sdk/s3-request-presigner', () => {
  const getSignedUrl = jest.fn(async () => MOCK_SIGNED_URL);
  return {
    getSignedUrl,
  };
});
jest.mock('@aws-sdk/lib-storage', () => {
  return {
    Upload: jest.fn().mockImplementation(() => {
      return {
        done: uploadDoneMock,
      };
    }),
  };
});

const expectPackedItemGeolocations = (
  results: PackedItemGeolocation[] | null,
  expected: PackedItemGeolocation[],
) => {
  expect(results).toHaveLength(expected.length);

  for (const ig of expected) {
    const publicTest = ig.item.public?.id
      ? { public: expect.objectContaining({ id: ig.item.public.id }) }
      : {};

    expect(results).toContainEqual(
      expect.objectContaining({
        lat: ig.lat,
        lng: ig.lng,
        addressLabel: ig.addressLabel,
        helperLabel: ig.helperLabel,
        country: ig.country,
        item: expect.objectContaining({
          id: ig.item.id,
          creator: ig.item.creator ? expect.objectContaining({ id: ig.item.creator.id }) : null,
          permission: ig.item.permission,
          ...publicTest,
        }),
      }),
    );
  }
};

describe('Item Geolocation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('GET /:id/geolocation', () => {
    describe('Signed out', () => {
      it('Get geolocation for public item', async () => {
        const {
          items: [item],
          itemMemberships: [im],
          geolocations: [geoloc],
          itemVisibilities,
        } = await seedFromJson({
          actor: null,
          items: [{ isPublic: true, geolocation: { lat: 1, lng: 2, country: 'de' } }],
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        const result = res.json();
        expectPackedItemGeolocations(
          [result],
          [
            {
              ...geoloc,
              item: new PackedItemDTO({ ...item, creator: null }, im, itemVisibilities).packed(),
            },
          ],
        );
      });

      it('Throws for non public item', async () => {
        const {
          items: [item],
        } = await seedFromJson({
          actor: null,
          items: [{ geolocation: { lat: 1, lng: 2, country: 'de' } }],
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(res.json()).toMatchObject(new MemberCannotAccess(expect.anything()));
      });
    });
    describe('Signed in', () => {
      it('Get geolocation', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [im],
          geolocations: [geoloc],
          itemVisibilities,
        } = await seedFromJson({
          items: [
            {
              creator: 'actor',
              geolocation: { lat: 1, lng: 2, country: 'de' },
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

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
        expectPackedItem(
          result.item,
          new PackedItemDTO({ ...item, creator: actor }, im, itemVisibilities).packed(),
        );
      });
      it('Get geolocation with thumbnails', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [im],
          geolocations: [geoloc],
          itemVisibilities,
        } = await seedFromJson({
          items: [
            {
              creator: 'actor',
              settings: { hasThumbnail: true },
              geolocation: { lat: 1, lng: 2, country: 'de' },
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

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
        expectPackedItem(
          result.item,
          new PackedItemDTO({ ...item, creator: actor }, im, itemVisibilities).packed(),
        );
        expectThumbnails(result.item, MOCK_SIGNED_URL, true);
      });
      it('Get geolocation without country', async () => {
        const {
          actor,
          items: [item],
          itemMemberships: [im],
          geolocations: [geoloc],
          itemVisibilities,
        } = await seedFromJson({
          items: [
            {
              creator: 'actor',
              settings: { hasThumbnail: true },
              geolocation: { lat: 1, lng: 2, country: null },
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

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
        expectPackedItem(
          result.item,
          new PackedItemDTO({ ...item, creator: actor }, im, itemVisibilities).packed(),
        );
      });
      it('Return null if no geolocation', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              creator: 'actor',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        assertIsMemberForTest(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toBeNull();
      });
      it('Throws if id is not a uuid', async () => {
        const { actor } = await seedFromJson({});
        assertIsDefined(actor);
        mockAuthenticate(actor);

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
      it('Does not get public item geolocations on root', async () => {
        await seedFromJson({
          actor: null,
          items: [
            {
              geolocation: { lat: 1, lng: 2, country: 'de' },
            },
            {
              geolocation: { lat: 1, lng: 2, country: 'de' },
            },
            {
              geolocation: { lat: 1, lng: 2, country: 'de' },
            },
          ],
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1&lng2=2`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toHaveLength(0);
        expectPackedItemGeolocations(res.json(), []);
      });
      it('Get public item geolocations within public item', async () => {
        const {
          items: [parentItem, ...children],
          geolocations,
        } = await seedFromJson({
          actor: null,
          items: [
            {
              isPublic: true,
              children: [
                {
                  geolocation: { lat: 1, lng: 2, country: 'de' },
                },
                {
                  geolocation: { lat: 1, lng: 2, country: 'de' },
                },
                {
                  geolocation: { lat: 1, lng: 2, country: 'de' },
                },
              ],
            },
          ],
        });

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1&lng2=2&parentItemId=${parentItem.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toHaveLength(3);
        expectPackedItemGeolocations(
          res.json(),
          children.map((c, idx) => ({
            ...geolocations[idx],
            item: new PackedItemDTO({ ...c, creator: null }).packed(),
          })),
        );
      });
    });
    describe('Signed in', () => {
      it('throws if missing one parameter', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

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
        const { actor, geolocations, items, itemMemberships } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              settings: { hasThumbnail: true },
              geolocation: { lat: 1, lng: 2, country: 'de' },
            },
            {
              memberships: [{ account: 'actor' }],
              geolocation: { lat: 1, lng: 2, country: 'de' },
            },
            {
              memberships: [{ account: 'actor' }],
              geolocation: { lat: 1, lng: 2, country: 'de' },
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1&lng2=2`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        const results = res.json();
        expectPackedItemGeolocations(
          results,
          items.map((i, idx) => ({
            ...geolocations[idx],
            item: new PackedItemDTO({ ...i, creator: null }, itemMemberships[idx]).packed(),
          })),
        );
        expectThumbnails(results[0].item, MOCK_SIGNED_URL, true);
      });

      it('Get item geolocations with search strings', async () => {
        const {
          actor,
          geolocations: [geoloc1, geoloc2, geoloc3],
          items: [item1, item2, item3],
        } = await seedFromJson({
          items: [
            {
              name: 'hello bye',
              memberships: [{ account: 'actor' }],
              settings: { hasThumbnail: true },
              geolocation: { lat: 1, lng: 2, country: 'de' },
            },
            {
              description: 'hello bye',
              memberships: [{ account: 'actor' }],
              geolocation: { lat: 1, lng: 2, country: 'de' },
            },
            {
              name: 'bye hello',
              memberships: [{ account: 'actor' }],
              geolocation: { lat: 1, lng: 2, country: 'de' },
            },
            {
              name: 'noise',
              memberships: [{ account: 'actor' }],
              geolocation: { lat: 1, lng: 2, country: 'de' },
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1&lng2=2&keywords=hello&keywords=bye`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toHaveLength(3);
        expectPackedItemGeolocations(res.json(), [
          { ...geoloc1, item: { ...resolveItemType(item1), creator: null, permission: 'admin' } },
          { ...geoloc2, item: { ...resolveItemType(item2), creator: null, permission: 'admin' } },
          { ...geoloc3, item: { ...resolveItemType(item3), creator: null, permission: 'admin' } },
        ]);
      });
      it('Get item geolocations within parent item', async () => {
        const {
          actor,
          geolocations: [geoloc1, geoloc2],
          items: [parentItem, child1, child2],
          itemMemberships: [im1],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor' }],
              children: [
                {
                  geolocation: { lat: 1, lng: 2, country: 'de' },
                },
                {
                  geolocation: { lat: 1, lng: 2, country: 'de' },
                },
                {},
              ],
            },
            // noise
            {
              memberships: [{ account: 'actor' }],
              geolocation: { lat: 1, lng: 2, country: 'de' },
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?parentItemId=${parentItem.id}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toHaveLength(2);
        const expectedPackedItemGeolocations = [
          {
            ...geoloc1,
            item: new PackedItemDTO({ ...child1, creator: null }, im1).packed(),
          },
          {
            ...geoloc2,
            item: new PackedItemDTO({ ...child2, creator: null }, im1).packed(),
          },
        ];
        expectPackedItemGeolocations(res.json(), expectedPackedItemGeolocations);
      });
      it('Throw for incorrect parent item id', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation?lat1=1&lat2=1&lng1=1&lng2=2&parentItemId=incorrect-id`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('Throw if no parent item id and no lat lng', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

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
        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${uuid()}/geolocation`,
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
      it('throw for invalid id', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/uuid/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('throw for no geolocation', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${uuid()}/geolocation`,
          body: {},
        });
      });
      it('throw for invalid lat or lng', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${uuid()}/geolocation`,
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
          url: `${ITEMS_ROUTE_PREFIX}/${uuid()}/geolocation`,
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
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${uuid()}/geolocation`,
          body: {
            geolocation: {
              lat: 1,
            },
          },
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
        const res1 = await app.inject({
          method: HttpMethod.Put,
          url: `${ITEMS_ROUTE_PREFIX}/${uuid()}/geolocation`,
          body: {
            geolocation: {
              lng: 1,
            },
          },
        });
        expect(res1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('save successfully', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [{ memberships: [{ account: 'actor', permission: 'admin' }] }],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

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
        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${uuid()}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });
    describe('Signed in', () => {
      it('throw for invalid id', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/uuid/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('delete successfully', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              memberships: [{ account: 'actor', permission: 'admin' }],
              geolocation: { lat: 1, lng: 2 },
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Delete,
          url: `${ITEMS_ROUTE_PREFIX}/${item.id}/geolocation`,
        });
        expect(res.statusCode).toBe(StatusCodes.NO_CONTENT);
      });
    });
  });
  describe('GET /geolocation/reverse', () => {
    describe('Signed out', () => {
      it('Throw', async () => {
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/reverse`,
          query: {
            lat: '2',
            lng: '2',
          },
        });
        expect(res.statusCode).toBe(StatusCodes.UNAUTHORIZED);
      });
    });
    describe('Signed in', () => {
      it('get adress from coordinates', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);
        if (GEOLOCATION_API_HOST) {
          nock(GEOLOCATION_API_HOST)
            .get('/reverse')
            .query(true)
            .reply(200, {
              results: [{ formatted: 'address', country: 'country' }],
            });
        }
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/reverse`,
          query: {
            lat: '2',
            lng: '2',
          },
        });
        expect(res.json()).toMatchObject({ addressLabel: 'address', country: 'country' });
      });
      it('throw if missing lat', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/reverse`,
          query: {
            lng: '2',
          },
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
      it('throw if missing lng', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/reverse`,
          query: {
            lat: '2',
          },
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
  describe('GET /geolocation/search', () => {
    describe('Signed out', () => {
      it('Throw', async () => {
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
      it('get address from search', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const id1 = uuid();
        const id2 = uuid();
        if (GEOLOCATION_API_HOST) {
          nock(GEOLOCATION_API_HOST)
            .get('/search')
            .query(true)
            .reply(200, {
              results: [
                { formatted: 'address', country_code: 'country', place_id: id1, lat: 45, lon: 23 },
                {
                  formatted: 'address1',
                  country_code: 'country1',
                  place_id: id2,
                  lat: 23,
                  lon: 12,
                },
              ],
            });
        }
        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/search`,
          query: {
            query: 'suggestion',
          },
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toMatchObject([
          {
            addressLabel: 'address',
            country: 'country',
            lat: 45,
            lng: 23,
            id: id1,
          },
          {
            addressLabel: 'address1',
            country: 'country1',
            id: id2,
            lat: 23,
            lng: 12,
          },
        ]);
      });
      it('throw if missing query', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const res = await app.inject({
          method: HttpMethod.Get,
          url: `${ITEMS_ROUTE_PREFIX}/geolocation/search`,
        });
        expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
