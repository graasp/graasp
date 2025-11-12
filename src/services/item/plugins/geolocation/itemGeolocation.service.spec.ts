import { v4 } from 'uuid';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PermissionLevel } from '@graasp/sdk';

import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { assertIsDefined } from '../../../../utils/assertions';
import { ItemNotFound, MemberCannotWriteItem } from '../../../../utils/errors';
import { assertIsMemberForTest } from '../../../authentication';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import { ItemGeolocationRepository } from './itemGeolocation.repository';
import { ItemGeolocationService } from './itemGeolocation.service';
import { expectPackedItemGeolocations } from './test/utils';

const itemThumbnailService = {
  getUrlsByItems: vi.fn(() => ({ small: 'url' })),
} as unknown as ItemThumbnailService;
const authorizedItemService = {
  getItemById: vi.fn(),
  getPropertiesForItems: vi.fn(),
} as unknown as AuthorizedItemService;
const itemGeolocationRepository = {
  getUrlsByItems: vi.fn(() => ({ small: 'url' })),
  delete: vi.fn(),
  put: vi.fn(),
  getByItem: vi.fn(),
  getItemsIn: vi.fn(),
} as unknown as ItemGeolocationRepository;

const service = new ItemGeolocationService(
  itemThumbnailService,
  authorizedItemService,
  itemGeolocationRepository,
  'geolocation-key',
);

describe('ItemGeolocationService', () => {
  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('delete', () => {
    it('delete successfully if has correct access to item', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            geolocation: { lat: 1, lng: 2, country: 'de' },
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValueOnce(item);
      const deleteMock = vi.spyOn(itemGeolocationRepository, 'delete');

      await service.delete(db, actor, item.id);

      expect(deleteMock).toHaveBeenCalled();
    });
    it('cannot delete with incorrect permission', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            geolocation: { lat: 1, lng: 2, country: 'de' },
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      vi.spyOn(authorizedItemService, 'getItemById').mockImplementationOnce(() => {
        throw new MemberCannotWriteItem(expect.anything());
      });
      const deleteMock = vi.spyOn(itemGeolocationRepository, 'delete');

      await service
        .delete(db, actor, item.id)
        .then(() => {
          throw new Error('This should have throw');
        })
        .catch((e) => {
          expect(e).toMatchObject(new MemberCannotWriteItem(expect.anything()));
        });

      expect(deleteMock).not.toHaveBeenCalled();
    });
  });

  describe('getByItem', () => {
    it('get successfully with correct permission', async () => {
      const {
        actor,
        items: [item],
        geolocations: [geolocation],
      } = await seedFromJson({
        items: [
          {
            geolocation: { lat: 1, lng: 2, country: 'de' },
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValueOnce(item);
      const getByItemMock = vi
        .spyOn(itemGeolocationRepository, 'getByItem')
        .mockResolvedValue({ ...geolocation, item });

      const res = await service.getByItem(db, actor, item.id);

      expect(getByItemMock).toHaveBeenCalled();
      expect(res).toMatchObject(geolocation);
    });

    it('return null if does not have geolocation', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{}],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValueOnce(item);
      vi.spyOn(itemGeolocationRepository, 'getByItem').mockResolvedValue(undefined);

      const res = await service.getByItem(db, actor, item.id);

      expect(res).toBeUndefined();
    });

    it('throws if item not found', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [{}],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      vi.spyOn(authorizedItemService, 'getItemById').mockRejectedValueOnce(
        new ItemNotFound(item.id),
      );

      await service
        .getByItem(db, actor, v4())
        .then(() => {
          throw new Error('This should have throw');
        })
        .catch((e) => {
          expect(e.message).toEqual(new ItemNotFound(item.id).message);
        });
    });
  });

  describe('getIn', () => {
    it('get successfully with read permission', async () => {
      const { actor, items, geolocations, itemMemberships } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            geolocation: {
              lat: 1,
              lng: 2,
              country: 'de',
            },
          },
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            geolocation: {
              lat: 1,
              lng: 2,
              country: 'de',
            },
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      vi.spyOn(itemGeolocationRepository, 'getItemsIn').mockResolvedValue([
        { ...geolocations[0], item: { ...items[0], creator: actor } },
        { ...geolocations[1], item: { ...items[1], creator: actor } },
      ]);
      vi.spyOn(authorizedItemService, 'getPropertiesForItems').mockResolvedValue({
        itemMemberships: {
          data: {
            [items[0].id]: itemMemberships[0],
            [items[1].id]: itemMemberships[1],
          },
          errors: [],
        },
        visibilities: {
          data: {},
          errors: [],
        },
      });

      const res = await service.getIn(db, actor, {
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
      });
      expect(res).toHaveLength(2);

      expectPackedItemGeolocations(res, [
        {
          ...geolocations[0],
          item: { ...items[0], creator: actor, permission: PermissionLevel.Read },
        },
        {
          ...geolocations[1],
          item: { ...items[1], creator: actor, permission: PermissionLevel.Read },
        },
      ]);
    });
    it('ignore public root item', async () => {
      const { actor, items, geolocations, itemMemberships, itemVisibilities } = await seedFromJson({
        items: [
          {
            isPublic: true,
            geolocation: {
              lat: 1,
              lng: 2,
              country: 'de',
            },
          },
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            geolocation: {
              lat: 1,
              lng: 2,
              country: 'de',
            },
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      vi.spyOn(itemGeolocationRepository, 'getItemsIn').mockResolvedValue([
        { ...geolocations[0], item: { ...items[0], creator: actor } },
        { ...geolocations[1], item: { ...items[1], creator: actor } },
      ]);
      vi.spyOn(authorizedItemService, 'getPropertiesForItems').mockResolvedValue({
        itemMemberships: {
          data: {
            [items[1].id]: itemMemberships[0],
          },
          errors: [],
        },
        visibilities: {
          data: { [items[0].id]: [{ ...itemVisibilities[0], item: items[0] }] },
          errors: [],
        },
      });
      const res = await service.getIn(db, actor, {
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
      });

      expect(res).toHaveLength(1);

      expectPackedItemGeolocations(res, [
        {
          ...geolocations[1],
          item: { ...items[1], creator: actor, permission: PermissionLevel.Read },
        },
      ]);
    });

    it('get successfully inside public item', async () => {
      const {
        actor,
        items: [parent, child],
        geolocations,
        itemVisibilities,
      } = await seedFromJson({
        items: [
          {
            isPublic: true,
            geolocation: {
              lat: 1,
              lng: 2,
              country: 'de',
            },
            children: [
              {
                geolocation: {
                  lat: 1,
                  lng: 2,
                  country: 'de',
                },
              },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      vi.spyOn(itemGeolocationRepository, 'getItemsIn').mockResolvedValue([
        { ...geolocations[0], item: { ...parent, creator: actor } },
      ]);
      vi.spyOn(authorizedItemService, 'getPropertiesForItems').mockResolvedValue({
        itemMemberships: {
          data: {
            [parent.id]: null,
            [child.id]: null,
          },
          errors: [],
        },
        visibilities: {
          data: {
            [parent.id]: [{ ...itemVisibilities[0], item: parent }],
          },
          errors: [],
        },
      });
      const res = await service.getIn(db, actor, {
        parentItemId: parent.id,
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
      });

      expect(res).toHaveLength(1);
      expectPackedItemGeolocations(res, [
        {
          ...geolocations[1],
          item: { ...parent, creator: actor, permission: null },
        },
      ]);
    });
    it('get successfully geolocalized child in public item', async () => {
      const {
        actor,
        items: [parent, child],
        geolocations,
        itemVisibilities,
      } = await seedFromJson({
        items: [
          {
            isPublic: true,
            children: [
              {
                geolocation: {
                  lat: 1,
                  lng: 2,
                  country: 'de',
                },
              },
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      vi.spyOn(itemGeolocationRepository, 'getItemsIn').mockResolvedValue([
        { ...geolocations[0], item: { ...child, creator: actor } },
      ]);
      vi.spyOn(authorizedItemService, 'getPropertiesForItems').mockResolvedValue({
        itemMemberships: {
          data: {
            [parent.id]: null,
            [child.id]: null,
          },
          errors: [],
        },
        visibilities: {
          data: {
            [parent.id]: [{ ...itemVisibilities[0], item: parent }],
            [child.id]: [{ ...itemVisibilities[0], item: parent }],
          },
          errors: [],
        },
      });

      const res = await service.getIn(db, actor, {
        parentItemId: parent.id,
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
      });
      expect(res).toHaveLength(1);
      expectPackedItemGeolocations(res, [
        {
          ...geolocations[0],
          item: { ...child, creator: actor, permission: null },
        },
      ]);
    });
    it('return empty for nothing in box', async () => {
      const {
        actor,
        items: [item],
        itemMemberships,
      } = await seedFromJson({
        items: [
          {
            geolocation: {
              lat: 1,
              lng: 6,
              country: 'de',
            },
            memberships: [{ account: 'actor' }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);
      vi.spyOn(itemGeolocationRepository, 'getItemsIn').mockResolvedValue([]);
      vi.spyOn(authorizedItemService, 'getPropertiesForItems').mockResolvedValue({
        itemMemberships: {
          data: {
            [item.id]: itemMemberships[0],
          },
          errors: [],
        },
        visibilities: {
          data: {},
          errors: [],
        },
      });

      const res = await service.getIn(db, actor, {
        lat1: 2,
        lat2: 4,
        lng1: 2,
        lng2: 4,
      });
      expect(res).toHaveLength(0);
    });
  });
  describe('put', () => {
    it('save successfully for admin permission', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Admin }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValueOnce(item);
      const putMock = vi.spyOn(itemGeolocationRepository, 'put');

      await service.put(db, actor, item.id, { lat: 1, lng: 2 });

      expect(putMock).toHaveBeenCalledWith(db, item.path, { lat: 1, lng: 2 });
    });
    it('save successfully for write permission', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Write }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValueOnce(item);
      const putMock = vi.spyOn(itemGeolocationRepository, 'put');

      await service.put(db, actor, item.id, { lat: 1, lng: 2 });

      expect(putMock).toHaveBeenCalledWith(db, item.path, { lat: 1, lng: 2 });
    });
    it('throws if basic item service get throws', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({
        items: [
          {
            memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      vi.spyOn(authorizedItemService, 'getItemById').mockImplementationOnce(() => {
        throw new MemberCannotWriteItem(expect.anything());
      });
      const putMock = vi.spyOn(itemGeolocationRepository, 'put');

      await service
        .put(db, actor, item.id, { lat: 1, lng: 2 })
        .then(() => {
          throw new Error('This should have throw');
        })
        .catch((e) => {
          expect(e).toMatchObject(new MemberCannotWriteItem(expect.anything()));
        });

      expect(putMock).not.toHaveBeenCalled();
    });
  });
});
