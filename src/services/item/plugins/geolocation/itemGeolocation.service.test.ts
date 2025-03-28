import { eq } from 'drizzle-orm';
import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { client, db } from '../../../../drizzle/db';
import { itemGeolocationsTable, itemsRaw } from '../../../../drizzle/schema';
import { BaseLogger } from '../../../../logger';
import { assertIsDefined } from '../../../../utils/assertions';
import { ItemNotFound, MemberCannotAccess, MemberCannotWriteItem } from '../../../../utils/errors';
import { assertIsMemberForTest } from '../../../authentication';
import { AuthorizationService } from '../../../authorization';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { ItemWrapper } from '../../ItemWrapper';
import { BasicItemService } from '../../basic.service';
import { ItemService } from '../../item.service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import { ItemGeolocationRepository } from './itemGeolocation.repository';
import { ItemGeolocationService } from './itemGeolocation.service';
import { expectPackedItemGeolocations } from './test/utils';

const itemThumbnailService = {
  getUrlsByItems: jest.fn(() => ({ small: 'url' })),
} as unknown as ItemThumbnailService;
const authorizationService = {
  validatePermissionMany: jest.fn(),
} as unknown as AuthorizationService;
const itemGeolocationRepository = {
  getUrlsByItems: jest.fn(() => ({ small: 'url' })),
  delete: jest.fn(),
  getByItem: jest.fn(),
  getItemsIn: jest.fn(),
} as unknown as ItemGeolocationRepository;

const basicItemService = {
  get: jest.fn(),
} as unknown as BasicItemService;

const service = new ItemGeolocationService(
  basicItemService,
  itemThumbnailService,
  authorizationService,
  itemGeolocationRepository,
  'geolocation-key',
);

describe('ItemGeolocationService', () => {
  beforeAll(async () => {
    client.connect();
  });

  afterAll(async () => {
    await clearDatabase(db);
    client.end();
  });

  afterEach(async () => {
    jest.clearAllMocks();
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

      jest.spyOn(basicItemService, 'get').mockResolvedValue({ ...item, creator: null });
      const deleteMock = jest.spyOn(itemGeolocationRepository, 'delete');

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

      jest.spyOn(basicItemService, 'get').mockImplementation(() => {
        throw new MemberCannotWriteItem(expect.anything());
      });
      const deleteMock = jest.spyOn(itemGeolocationRepository, 'delete');

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

        jest.spyOn(basicItemService, 'get').mockResolvedValue({ ...item, creator: null });
        const getByItemMock = jest
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

        jest.spyOn(basicItemService, 'get').mockResolvedValue({ ...item, creator: null });
        jest.spyOn(itemGeolocationRepository, 'getByItem').mockResolvedValue(undefined);

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

        jest.spyOn(basicItemService, 'get').mockRejectedValue(new ItemNotFound(item.id));

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

        jest.spyOn(itemGeolocationRepository, 'getItemsIn').mockResolvedValue([
          { ...geolocations[0], item: { ...items[0], creator: actor } },
          { ...geolocations[1], item: { ...items[1], creator: actor } },
        ]);
        jest.spyOn(authorizationService, 'validatePermissionMany').mockResolvedValue({
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
        const { actor, items, geolocations, itemMemberships, itemVisibilities } =
          await seedFromJson({
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

        jest.spyOn(itemGeolocationRepository, 'getItemsIn').mockResolvedValue([
          { ...geolocations[0], item: { ...items[0], creator: actor } },
          { ...geolocations[1], item: { ...items[1], creator: actor } },
        ]);
        jest.spyOn(authorizationService, 'validatePermissionMany').mockResolvedValue({
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
      // TODO
      // it('get successfully inside public item', async () => {
      //   const {
      //     actor,
      //     items: [parent, child],
      //     geolocations,
      //     itemVisibilities,
      //   } = await seedFromJson({
      //     items: [
      //       {
      //         isPublic: true,
      //         geolocation: {
      //           lat: 1,
      //           lng: 2,
      //           country: 'de',
      //         },
      //         children: [
      //           {
      //             geolocation: {
      //               lat: 1,
      //               lng: 2,
      //               country: 'de',
      //             },
      //           },
      //         ],
      //       },
      //     ],
      //   });
      //   assertIsDefined(actor);
      //   assertIsMemberForTest(actor);

      //   jest.spyOn(itemGeolocationRepository, 'getItemsIn').mockResolvedValue([
      //     { ...geolocations[0], item: { ...parent, creator: actor } },
      //     { ...geolocations[1], item: { ...child, creator: actor } },
      //   ]);
      //   jest.spyOn(authorizationService, 'validatePermissionMany').mockResolvedValue({
      //     itemMemberships: {
      //       data: {},
      //       errors: [],
      //     },
      //     visibilities: {
      //       data: {
      //         [parent.id]: [{ ...itemVisibilities[0], item: parent }],
      //         [child.id]: [{ ...itemVisibilities[0], item: parent }],
      //       },
      //       errors: [],
      //     },
      //   });
      //   const res = await service.getIn(db, actor, {
      //     lat1: 0,
      //     lat2: 4,
      //     lng1: 0,
      //     lng2: 4,
      //   });

      //   expect(res).toHaveLength(1);
      //   expectPackedItemGeolocations(res, [
      //     {
      //       ...geolocations[1],
      //       item: { ...parent, creator: actor, permission: null },
      //     },
      //     {
      //       ...geolocations[1],
      //       item: { ...child, creator: actor, permission: null },
      //     },
      //   ]);
      // });
      //   it('get successfully geolocalized child in public item', async () => {
      //     const member = await saveMember();
      //     const { item: publicItem } = await testUtils.savePublicItem({ member });
      //     const child = await testUtils.saveItem({
      //       actor: member,
      //       parentItem: publicItem,
      //     });
      //     const { packed: geoloc } = await saveGeolocation({
      //       lat: 1,
      //       lng: 2,
      //       item: new ItemWrapper(child, null).packed(),
      //       country: 'de',
      //     });
      //     const res = await service.getIn(actor, buildRepositories(), {
      //       parentItemId: publicItem.id,
      //       lat1: 0,
      //       lat2: 4,
      //       lng1: 0,
      //       lng2: 4,
      //     });
      //     expect(res).toHaveLength(1);
      //     expectPackedItemGeolocations(res, [geoloc]);
      //   });
      //   it('return empty for nothing in box', async () => {
      //     // noise
      //     const member = await saveMember();
      //     const { item } = await testUtils.saveItemAndMembership({
      //       member: actor,
      //       creator: member,
      //       permission: PermissionLevel.Read,
      //     });
      //     const geoloc = { lat: 1, lng: 6, item, country: 'de' };
      //     await rawRepository.save(geoloc);
      //     const res = await service.getIn(actor, buildRepositories(), {
      //       lat1: 2,
      //       lat2: 4,
      //       lng1: 2,
      //       lng2: 4,
      //     });
      //     expect(res).toHaveLength(0);
      //   });
      // });
      // describe('put', () => {
      //   it('save successfully for admin permission', async () => {
      //     assertIsDefined(actor);
      //     const { item } = await testUtils.saveItemAndMembership({
      //       member: actor,
      //     });
      //     await service.put(actor, buildRepositories(), item.id, { lat: 1, lng: 2 });
      //     const all = await ItemGeolocation.find();
      //     expect(all).toHaveLength(1);
      //     expect(all[0]).toMatchObject({ lat: 1, lng: 2 });
      //   });
      //   it('save successfully for write permission', async () => {
      //     assertIsDefined(actor);
      //     const member = await saveMember();
      //     const { item } = await testUtils.saveItemAndMembership({
      //       member: actor,
      //       creator: member,
      //       permission: PermissionLevel.Write,
      //     });
      //     await service.put(actor, buildRepositories(), item.id, { lat: 1, lng: 2 });
      //     const all = await ItemGeolocation.find();
      //     expect(all).toHaveLength(1);
      //     expect(all[0]).toMatchObject({ lat: 1, lng: 2 });
      //   });
      //   it('throws for read permission', async () => {
      //     assertIsDefined(actor);
      //     const member = await saveMember();
      //     const { item } = await testUtils.saveItemAndMembership({
      //       member: actor,
      //       creator: member,
      //       permission: PermissionLevel.Read,
      //     });
      //     await service.put(actor, buildRepositories(), item.id, { lat: 1, lng: 2 }).catch((e) => {
      //       expect(e).toMatchObject(new MemberCannotWriteItem(expect.anything()));
      //     });
      //   });
      //   it('throws if item not found', async () => {
      //     assertIsDefined(actor);
      //     await service
      //       .put(actor, buildRepositories(), v4(), { lat: 1, lng: 2 })
      //       .then(() => {
      //         throw new Error('This should have throw');
      //       })
      //       .catch((e) => {
      //         expect(e).toMatchObject(new ItemNotFound(expect.anything()));
      //       });
    });
  });
});
