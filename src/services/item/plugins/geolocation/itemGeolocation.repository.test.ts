import { eq } from 'drizzle-orm/sql';

import { clearDatabase } from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { client, db } from '../../../../drizzle/db';
import { itemGeolocationsTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { assertIsMemberForTest } from '../../../authentication';
import { MissingGeolocationSearchParams } from './errors';
import { ItemGeolocationRepository } from './itemGeolocation.repository';
import { expectItemGeolocations } from './test/utils';

const repository = new ItemGeolocationRepository();

const getGeolocationByItemPath = async (itemPath) => {
  return await db.query.itemGeolocationsTable.findFirst({
    where: eq(itemGeolocationsTable.itemPath, itemPath),
  });
};

describe('ItemGeolocationRepository', () => {
  beforeAll(async () => {
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
    await clearDatabase(db);
  });

  describe('copy', () => {
    it('copy geolocation on item copy', async () => {
      const {
        items: [originalItem, copyItem],
        geolocations: [geoloc],
      } = await seedFromJson({
        items: [
          {
            geolocation: {
              lat: 1,
              lng: 2,
              country: 'de',
              helperLabel: 'helper text',
              addressLabel: 'address',
            },
          },
          {},
        ],
      });

      // ACTION: copy the original item geolocation onto the copy item
      await repository.copy(db, originalItem, copyItem);

      // EXPECT: a new geolocation to exist for the copy item
      const newCopyGeoloc = await getGeolocationByItemPath(copyItem.path);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { itemPath, createdAt, updatedAt, id, ...originalGeoloc } = geoloc;
      expect(newCopyGeoloc).toMatchObject(originalGeoloc);
      expect(newCopyGeoloc!.itemPath).toEqual(copyItem.path);
    });
    it('does nothing if no geolocation attached', async () => {
      const {
        items: [originalItem, copyItem],
      } = await seedFromJson({
        items: [{}, {}],
      });

      await repository.copy(db, originalItem, copyItem);

      expect(await getGeolocationByItemPath(copyItem.path)).toBeUndefined();
    });
  });
  describe('delete', () => {
    it('delete geolocation', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        items: [
          {
            geolocation: {
              lat: 1,
              lng: 2,
              country: 'de',
              helperLabel: 'helper text',
              addressLabel: 'address',
            },
          },
          {},
        ],
      });

      await repository.delete(db, item);

      expect(await getGeolocationByItemPath(item.path)).toBeUndefined();
    });
    it('do nothing if no geolocation attached', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        items: [{}],
      });

      expect(await getGeolocationByItemPath(item.path)).toBeUndefined();

      await repository.delete(db, item);

      expect(await getGeolocationByItemPath(item.path)).toBeUndefined();
    });
  });

  describe('getByItem', () => {
    it('returns direct geolocation', async () => {
      const {
        items: [_parent, item],
        geolocations: [_parentGeoloc, geoloc],
      } = await seedFromJson({
        items: [
          {
            geolocation: {
              lat: 1,
              lng: 2,
              country: 'fr',
              helperLabel: 'helper1',
            },
            children: [
              {
                geolocation: {
                  lat: 1,
                  lng: 2,
                  country: 'de',
                  helperLabel: 'helper',
                },
              },
            ],
          },
          {},
        ],
      });

      const res = await repository.getByItem(db, item.path);
      expect(res).toMatchObject({
        lat: geoloc.lat,
        lng: geoloc.lng,
        country: geoloc.country,
        helperLabel: geoloc.helperLabel,
      });
    });
    it('returns inherited geolocation', async () => {
      const {
        items: [_parent, item],
        geolocations: [geolocParent],
      } = await seedFromJson({
        items: [
          {
            geolocation: {
              lat: 1,
              lng: 2,
              country: 'fr',
              helperLabel: 'helper1',
            },
            children: [{}],
          },
          {},
        ],
      });

      const res = await repository.getByItem(db, item.path);
      expect(res).toMatchObject({
        lat: geolocParent.lat,
        lng: geolocParent.lng,
        country: geolocParent.country,
      });
    });
    it('returns no geolocation', async () => {
      const {
        items: [item],
      } = await seedFromJson({
        items: [{}],
      });

      const res = await repository.getByItem(db, item.path);
      expect(res).toBeUndefined();
    });
  });
  describe('getItemsIn', () => {
    it('returns items in box', async () => {
      const {
        actor,
        geolocations: [geolocParent, geoloc],
      } = await seedFromJson({
        items: [
          {
            creator: 'actor',
            geolocation: {
              lat: 1,
              lng: 2,
              country: 'de',
              helperLabel: 'helper',
            },
            children: [
              {
                geolocation: {
                  lat: 1,
                  lng: 2,
                  country: 'fr',
                  helperLabel: 'helper1',
                },
              },
            ],
          },
          {},
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const res = await repository.getItemsIn(db, actor, {
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
      });

      // without parent bounds, repository can return a lot of items
      expect(res.length).toBeGreaterThanOrEqual(2);

      const geolocIds = res.map((g) => g.id);
      expect(geolocIds).toContain(geoloc.id);
      expect(geolocIds).toContain(geolocParent.id);
    });
    it('returns nothing when out of bounds', async () => {
      const { actor } = await seedFromJson({
        items: [
          {
            creator: 'actor',
            geolocation: {
              lat: 1,
              lng: 2,
              country: 'de',
              helperLabel: 'helper',
            },
            children: [
              {
                geolocation: {
                  lat: 1,
                  lng: 2,
                  country: 'fr',
                  helperLabel: 'helper1',
                },
              },
            ],
          },
          {},
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const res = await repository.getItemsIn(db, actor, {
        lat1: 0,
        lat2: 0.1,
        lng1: 0,
        lng2: 0.1,
      });
      expect(res).toHaveLength(0);
    });
    it('returns with swapped values', async () => {
      const {
        actor,
        geolocations: [geolocParent, geoloc],
      } = await seedFromJson({
        items: [
          {
            creator: 'actor',
            geolocation: {
              lat: 1,
              lng: 2,
              country: 'de',
              helperLabel: 'helper',
            },
            children: [
              {
                geolocation: {
                  lat: 1,
                  lng: 2,
                  country: 'fr',
                  helperLabel: 'helper1',
                },
              },
            ],
          },
          {},
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const res = await repository.getItemsIn(db, actor, {
        lat1: 4,
        lat2: 0,
        lng1: 4,
        lng2: 0,
      });
      expect(res.length).toBeGreaterThanOrEqual(2);
      const gIds = res.map((g) => g.id);
      expect(gIds).toContain(geoloc.id);
      expect(gIds).toContain(geolocParent.id);
    });
    // TODO
    //     it('return with keywords in english and french', async () => {
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({
    //         item: { name: 'chat chien', lang: 'fr' },
    //         member: actor,
    //       });
    //       const { item } = await testUtils.saveItemAndMembership({
    //         item: { name: 'poisson', lang: 'fr' },
    //         member: actor,
    //         parentItem,
    //       });
    //       const geoloc = { lat: 1, lng: 2, item, country: 'de' };
    //       await rawRepository.save(geoloc);
    //       const geolocParent = await rawRepository.save({
    //         lat: 1,
    //         lng: 2,
    //         item: parentItem,
    //         country: 'de',
    //       });
    //       // noise
    //       await testUtils.saveItemAndMembership({ member: actor, parentItem });
    //       const res = await repository.getItemsIn(
    //         { ...actor, lang: 'fr' },
    //         {
    //           lat1: 0,
    //           lat2: 4,
    //           lng1: 0,
    //           lng2: 4,
    //           keywords: ['chats'],
    //         },
    //       );
    //       expect(res).toHaveLength(1);
    //       expectItemGeolocations(res, [geolocParent]);
    //     });
    //     it('return with keywords in english and spanish', async () => {
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({
    //         item: { name: 'gatos perros', lang: 'es' },
    //         member: actor,
    //       });
    //       const { item } = await testUtils.saveItemAndMembership({
    //         item: { name: 'poisson', lang: 'fr' },
    //         member: actor,
    //         parentItem,
    //       });
    //       const geoloc = {
    //         lat: 1,
    //         lng: 2,
    //         item,
    //         country: 'de',
    //         helperLabel: 'helper',
    //       };
    //       await rawRepository.save(geoloc);
    //       const geolocParent = await rawRepository.save({
    //         lat: 1,
    //         lng: 2,
    //         item: parentItem,
    //         country: 'de',
    //       });
    //       // noise
    //       await testUtils.saveItemAndMembership({ member: actor, parentItem });
    //       const res1 = await repository.getItemsIn(
    //         { ...actor, lang: 'fr' },
    //         {
    //           lat1: 0,
    //           lat2: 4,
    //           lng1: 0,
    //           lng2: 4,
    //           // this checked the search_document stemmed correctly gatos
    //           keywords: ['gato'],
    //         },
    //       );
    //       expect(res1).toHaveLength(1);
    //       expectItemGeolocations(res1, [geolocParent]);
    //     });
    //     it('return only item within keywords in name', async () => {
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({
    //         item: { name: 'publics private' },
    //         member: actor,
    //       });
    //       const { item } = await testUtils.saveItemAndMembership({
    //         item: { name: 'private publication' },
    //         member: actor,
    //         parentItem,
    //       });
    //       const geoloc = await rawRepository.save({
    //         lat: 1,
    //         lng: 2,
    //         item,
    //         country: 'de',
    //       });
    //       const geolocParent = await rawRepository.save({
    //         lat: 1,
    //         lng: 2,
    //         item: parentItem,
    //         country: 'de',
    //       });
    //       // noise
    //       await testUtils.saveItemAndMembership({ member: actor, parentItem });
    //       const res = await repository.getItemsIn(actor, {
    //         lat1: 0,
    //         lat2: 4,
    //         lng1: 0,
    //         lng2: 4,
    //         keywords: ['public', 'private'],
    //       });
    //       expect(res).toHaveLength(2);
    //       expectItemGeolocations(res, [geoloc, geolocParent]);
    //     });
    //     it('return only item within keywords in description', async () => {
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({
    //         item: { description: 'public' },
    //         member: actor,
    //       });
    //       const { item } = await testUtils.saveItemAndMembership({
    //         item: { description: 'private' },
    //         member: actor,
    //         parentItem,
    //       });
    //       await rawRepository.save({ lat: 1, lng: 2, item, country: 'de' });
    //       const geolocParent = await rawRepository.save({
    //         lat: 1,
    //         lng: 2,
    //         item: parentItem,
    //         country: 'de',
    //       });
    //       // noise
    //       await testUtils.saveItemAndMembership({ member: actor, parentItem });
    //       const res = await repository.getItemsIn(actor, {
    //         lat1: 0,
    //         lat2: 4,
    //         lng1: 0,
    //         lng2: 4,
    //         keywords: ['public'],
    //       });
    //       expect(res).toHaveLength(1);
    //       expectItemGeolocations(res, [geolocParent]);
    //     });
    //     it('return only item within keywords in tags', async () => {
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({
    //         item: { settings: { tags: ['public'] } },
    //         member: actor,
    //       });
    //       const { item } = await testUtils.saveItemAndMembership({
    //         item: { settings: { tags: ['private'] } },
    //         member: actor,
    //         parentItem,
    //       });
    //       await rawRepository.save({ lat: 1, lng: 2, item, country: 'de' });
    //       const geolocParent = await rawRepository.save({
    //         lat: 1,
    //         lng: 2,
    //         item: parentItem,
    //         country: 'de',
    //       });
    //       // noise
    //       await testUtils.saveItemAndMembership({ member: actor, parentItem });
    //       const res = await repository.getItemsIn(actor, {
    //         lat1: 0,
    //         lat2: 4,
    //         lng1: 0,
    //         lng2: 4,
    //         keywords: ['public'],
    //       });
    //       expect(res).toHaveLength(1);
    //       expectItemGeolocations(res, [geolocParent]);
    //     });
    //     it('return only item with keywords in file content', async () => {
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({
    //         member: actor,
    //       });
    //       const { item: item1 } = await testUtils.saveItemAndMembership({
    //         item: {
    //           type: ItemType.LOCAL_FILE,
    //           extra: {
    //             [ItemType.LOCAL_FILE]: {
    //               content: 'public',
    //               name: 'name',
    //               path: 'path',
    //               mimetype: 'mimetype',
    //               size: 1,
    //             },
    //           },
    //         },
    //         member: actor,
    //         parentItem,
    //       });
    //       const geoloc = await rawRepository.save({
    //         lat: 1,
    //         lng: 2,
    //         item: item1,
    //         country: 'de',
    //       });
    //       await rawRepository.save({
    //         lat: 1,
    //         lng: 2,
    //         item: parentItem,
    //         country: 'de',
    //       });
    //       // noise
    //       await testUtils.saveItemAndMembership({ member: actor, parentItem });
    //       const { item: item2 } = await testUtils.saveItemAndMembership({
    //         item: {
    //           type: ItemType.LOCAL_FILE,
    //           extra: {
    //             [ItemType.LOCAL_FILE]: {
    //               content: 'private',
    //               name: 'name',
    //               path: 'path',
    //               mimetype: 'mimetype',
    //               size: 1,
    //             },
    //           },
    //         },
    //         member: actor,
    //         parentItem,
    //       });
    //       await rawRepository.save({ lat: 1, lng: 2, item: item2, country: 'de' });
    //       const res = await repository.getItemsIn(actor, {
    //         lat1: 0,
    //         lat2: 4,
    //         lng1: 0,
    //         lng2: 4,
    //         keywords: ['public'],
    //       });
    //       expect(res).toHaveLength(1);
    //       expectItemGeolocations(res, [geoloc]);
    //     });
    //     it('return only item with keywords in s3File content', async () => {
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({
    //         member: actor,
    //       });
    //       const { item: item1 } = await testUtils.saveItemAndMembership({
    //         item: {
    //           type: ItemType.S3_FILE,
    //           extra: {
    //             [ItemType.S3_FILE]: {
    //               content: 'public',
    //               name: 'name',
    //               path: 'path',
    //               mimetype: 'mimetype',
    //               size: 1,
    //             },
    //           },
    //         },
    //         member: actor,
    //       });
    //       const geoloc = await rawRepository.save({
    //         lat: 1,
    //         lng: 2,
    //         item: item1,
    //         country: 'de',
    //       });
    //       await rawRepository.save({
    //         lat: 1,
    //         lng: 2,
    //         item: parentItem,
    //         country: 'de',
    //       });
    //       // noise
    //       await testUtils.saveItemAndMembership({ member: actor, parentItem });
    //       const { item: item2 } = await testUtils.saveItemAndMembership({
    //         item: {
    //           type: ItemType.S3_FILE,
    //           extra: {
    //             [ItemType.S3_FILE]: {
    //               content: 'private',
    //               name: 'name',
    //               path: 'path',
    //               mimetype: 'mimetype',
    //               size: 1,
    //             },
    //           },
    //         },
    //         member: actor,
    //         parentItem,
    //       });
    //       await rawRepository.save({ lat: 1, lng: 2, item: item2, country: 'de' });
    //       const res = await repository.getItemsIn(actor, {
    //         lat1: 0,
    //         lat2: 4,
    //         lng1: 0,
    //         lng2: 4,
    //         keywords: ['public'],
    //       });
    //       expect(res).toHaveLength(1);
    //       expectItemGeolocations(res, [geoloc]);
    //     });
    //     it('return only item with keywords in document content', async () => {
    //       const { item: parentItem } = await testUtils.saveItemAndMembership({
    //         member: actor,
    //       });
    //       const { item: item1 } = await testUtils.saveItemAndMembership({
    //         item: {
    //           type: ItemType.DOCUMENT,
    //           extra: {
    //             [ItemType.DOCUMENT]: {
    //               content: 'public',
    //             },
    //           },
    //         },
    //         member: actor,
    //         parentItem,
    //       });
    //       const geoloc = await rawRepository.save({
    //         lat: 1,
    //         lng: 2,
    //         item: item1,
    //         country: 'de',
    //         helperLabel: 'helper',
    //       });
    //       await rawRepository.save({
    //         lat: 1,
    //         lng: 2,
    //         item: parentItem,
    //         country: 'de',
    //       });
    //       // noise
    //       await testUtils.saveItemAndMembership({ member: actor, parentItem });
    //       const { item: item2 } = await testUtils.saveItemAndMembership({
    //         item: {
    //           type: ItemType.DOCUMENT,
    //           extra: {
    //             [ItemType.DOCUMENT]: {
    //               content: 'private',
    //             },
    //           },
    //         },
    //         member: actor,
    //         parentItem,
    //       });
    //       await rawRepository.save({ lat: 1, lng: 2, item: item2, country: 'de' });
    //       const res = await repository.getItemsIn(actor, {
    //         lat1: 0,
    //         lat2: 4,
    //         lng1: 0,
    //         lng2: 4,
    //         keywords: ['public'],
    //       });
    //       expect(res).toHaveLength(1);
    //       expectItemGeolocations(res, [geoloc]);
    //     });
    it('return only non-recycled items in parent', async () => {
      const {
        actor,
        items: [parent, item],
        geolocations: [geoloc],
      } = await seedFromJson({
        items: [
          {
            children: [
              {
                creator: 'actor',
                geolocation: {
                  lat: 1,
                  lng: 2,
                  country: 'de',
                  helperLabel: 'helper',
                },
              },
              {
                isDeleted: true,
                creator: 'actor',
                geolocation: {
                  lat: 1,
                  lng: 2,
                  country: 'de',
                  helperLabel: 'helper',
                },
              },
              {},
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const res = await repository.getItemsIn(
        db,
        actor,
        {
          lat1: 0,
          lat2: 4,
          lng1: 0,
          lng2: 4,
        },
        parent,
      );
      expect(res.length).toEqual(1);
      expectItemGeolocations(res, [{ ...geoloc, item: { ...item, creator: actor } }]);
    });
    it('return only children for given parent item with bounds', async () => {
      const {
        actor,
        items: [parent],
        geolocations: [geoloc1, geoloc2],
      } = await seedFromJson({
        items: [
          {
            children: [
              {
                creator: 'actor',
                geolocation: {
                  lat: 1,
                  lng: 2,
                  country: 'de',
                  helperLabel: 'helper',
                },
              },
              {
                creator: 'actor',
                geolocation: {
                  lat: 1,
                  lng: 2,
                  country: 'de',
                  helperLabel: 'helper',
                },
              },
              {},
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const res = await repository.getItemsIn(
        db,
        actor,
        {
          lat1: 0,
          lat2: 4,
          lng1: 0,
          lng2: 4,
        },
        parent,
      );
      const gIds = res.map((g) => g.id);
      expect(gIds).toContain(geoloc1.id);
      expect(gIds).toContain(geoloc2.id);
    });
    it('return only children for given parent item', async () => {
      const {
        actor,
        items: [parent],
        geolocations: [geoloc1, geoloc2],
      } = await seedFromJson({
        items: [
          {
            children: [
              {
                creator: 'actor',
                geolocation: {
                  lat: 1,
                  lng: 2,
                  country: 'de',
                  helperLabel: 'helper',
                },
              },
              {
                creator: 'actor',
                geolocation: {
                  lat: 1,
                  lng: 2,
                  country: 'de',
                  helperLabel: 'helper',
                },
              },
              {},
            ],
          },
        ],
      });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const res = await repository.getItemsIn(db, actor, {}, parent);
      const gIds = res.map((g) => g.id);
      expect(gIds).toContain(geoloc1.id);
      expect(gIds).toContain(geoloc2.id);
    });
    it('throw if does not provide parent item or lat lng', async () => {
      const { actor } = await seedFromJson();
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      repository
        .getItemsIn(db, actor, {
          lat1: null,
          lat2: null,
          lng1: null,
          lng2: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .catch((e) => {
          expect(e).toMatchObject(new MissingGeolocationSearchParams(expect.anything()));
        });
      repository
        .getItemsIn(db, actor, {
          lat1: 1,
          lat2: 2,
          lng1: 1,
          lng2: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .catch((e) => {
          expect(e).toMatchObject(new MissingGeolocationSearchParams(expect.anything()));
        });
      repository
        .getItemsIn(db, actor, {
          lat1: 1,
          lat2: 2,
          lng1: 1,
          lng2: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .catch((e) => {
          expect(e).toMatchObject(new MissingGeolocationSearchParams(expect.anything()));
        });
    });
  });
  describe('put', () => {
    it('create new geolocation for item', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const lat = 46.2017559;
      const lng = 6.1466014;
      await repository.put(db, item.path, { lat, lng });

      const geoloc = await getGeolocationByItemPath(item.path);
      expect(geoloc).toMatchObject({ lat, lng, country: 'CH' });
    });
    it('create new geolocation for item with address and helper', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const lat = 46.2017559;
      const lng = 6.1466014;
      const helperLabel = 'helper';
      const addressLabel = 'address';
      await repository.put(db, item.path, { lat, lng, helperLabel, addressLabel });

      const geoloc = await getGeolocationByItemPath(item.path);
      expect(geoloc).toMatchObject({
        lat,
        lng,
        country: 'CH',
        helperLabel,
        addressLabel,
      });
    });
    it('create new geolocation that does not have a country', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{}] });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const lat = 1;
      const lng = 2;
      await repository.put(db, item.path, { lat, lng });
      const geoloc = await getGeolocationByItemPath(item.path);
      expect(geoloc).toMatchObject({ lat, lng, country: null });
    });
    it('update geolocation', async () => {
      const {
        actor,
        items: [item],
      } = await seedFromJson({ items: [{ geolocation: { lat: 1, lng: 2, country: 'de' } }] });
      assertIsDefined(actor);
      assertIsMemberForTest(actor);

      const lat = 46.2017559;
      const lng = 6.1466014;
      await repository.put(db, item.path, { lat, lng });
      const geoloc = await getGeolocationByItemPath(item.path);
      expect(geoloc).toMatchObject({ lat, lng, country: 'CH' });
    });
  });
});
