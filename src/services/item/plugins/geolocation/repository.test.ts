import { ItemType } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { AppDataSource } from '../../../../plugins/datasource';
import { saveItemAndMembership } from '../../../itemMembership/test/fixtures/memberships';
import { getDummyItem } from '../../test/fixtures/items';
import { ItemGeolocation } from './ItemGeolocation';
import { ItemGeolocationRepository } from './repository';

// mock datasource
jest.mock('../../../../plugins/datasource');

const rawRepository = AppDataSource.getRepository(ItemGeolocation);
const repository = new ItemGeolocationRepository();

describe('ItemGeolocationRepository', () => {
  let app;
  let actor;

  beforeEach(async () => {
    ({ app, actor } = await build());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });
  describe('copy', () => {
    it('copy geolocation on item copy', async () => {
      const { item: originalItem } = await saveItemAndMembership({ member: actor });
      const { item: copyItem } = await saveItemAndMembership({ member: actor });
      const geoloc = { lat: 1, lng: 2, item: originalItem, country: 'de' };
      await rawRepository.save(geoloc);

      await repository.copy(originalItem, copyItem);

      const allGeoloc = await rawRepository.find({ relations: { item: true } });
      expect(allGeoloc).toHaveLength(2);
      expect(allGeoloc).toContainEqual(
        expect.objectContaining({
          ...geoloc,
          item: expect.objectContaining({
            id: originalItem.id,
          }),
        }),
      );
      expect(allGeoloc).toContainEqual(
        expect.objectContaining({
          // ...geoloc,
          item: expect.objectContaining({
            id: copyItem.id,
          }),
        }),
      );
    });
    it('does nothing if no geolocation attached', async () => {
      const { item: originalItem } = await saveItemAndMembership({ member: actor });
      const { item: copyItem } = await saveItemAndMembership({ member: actor });

      // noise
      const { item: item1 } = await saveItemAndMembership({ member: actor });
      const geolocParent = { lat: 1, lng: 2, item: item1, country: 'de' };
      await rawRepository.save(geolocParent);

      await repository.copy(originalItem, copyItem);

      const allGeoloc = await rawRepository.find();
      expect(allGeoloc).toHaveLength(1);
    });
  });
  describe('delete', () => {
    it('delete geolocation', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);

      // noise
      const { item: item1 } = await saveItemAndMembership({ member: actor });
      const geolocParent = { lat: 1, lng: 2, item: item1, country: 'de' };
      await rawRepository.save(geolocParent);

      await repository.delete(item);

      const allGeoloc = await rawRepository.find();
      expect(allGeoloc).toHaveLength(1);
    });
    it('do nothing if no geolocation attached', async () => {
      const { item } = await saveItemAndMembership({ member: actor });

      // noise
      const { item: item1 } = await saveItemAndMembership({ member: actor });
      const geolocParent = { lat: 1, lng: 2, item: item1, country: 'de' };
      await rawRepository.save(geolocParent);

      await repository.delete(item);

      const allGeoloc = await rawRepository.find();
      expect(allGeoloc).toHaveLength(1);
    });
  });

  describe('getByItem', () => {
    it('returns direct geolocation', async () => {
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item } = await saveItemAndMembership({ member: actor, parentItem });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);

      // noise
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'fr' };
      await rawRepository.save(geolocParent);

      const res = await repository.getByItem(item);
      expect(res).toMatchObject({
        lat: geoloc.lat,
        lng: geoloc.lng,
        country: geoloc.country,
      });
    });

    it('returns inherited geolocation', async () => {
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item } = await saveItemAndMembership({ member: actor, parentItem });
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'de' };
      await rawRepository.save(geolocParent);

      const res = await repository.getByItem(item);
      expect(res).toMatchObject({
        lat: geolocParent.lat,
        lng: geolocParent.lng,
        country: geolocParent.country,
      });
    });

    it('returns no geolocation', async () => {
      const { item } = await saveItemAndMembership({ member: actor });

      // noise
      const { item: item1 } = await saveItemAndMembership({ member: actor });
      const geolocParent = { lat: 1, lng: 2, item: item1, country: 'fr' };
      await rawRepository.save(geolocParent);

      const res = await repository.getByItem(item);
      expect(res).toBeNull();
    });
  });

  describe('getItemsIn', () => {
    it('returns items in box', async () => {
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item } = await saveItemAndMembership({ member: actor, parentItem });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'de' };
      await rawRepository.save(geolocParent);

      // noise
      await saveItemAndMembership({ member: actor, parentItem });

      const res = await repository.getItemsIn(actor, { lat1: 0, lat2: 4, lng1: 0, lng2: 4 });
      expect(res).toHaveLength(2);
      expect(res).toContainEqual(geoloc);
      expect(res).toContainEqual(geolocParent);
    });

    it('returns nothing', async () => {
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item } = await saveItemAndMembership({ member: actor, parentItem });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'de' };
      await rawRepository.save(geolocParent);

      // noise
      await saveItemAndMembership({ member: actor, parentItem });

      const res = await repository.getItemsIn(actor, { lat1: 0, lat2: 0.5, lng1: 0, lng2: 0.5 });
      expect(res).toHaveLength(0);
    });

    it('returns with swapped values', async () => {
      const { item: parentItem } = await saveItemAndMembership({ member: actor });
      const { item } = await saveItemAndMembership({ member: actor, parentItem });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'de' };
      await rawRepository.save(geolocParent);

      // noise
      await saveItemAndMembership({ member: actor, parentItem });

      const res = await repository.getItemsIn(actor, { lat1: 0, lat2: 4, lng1: 0, lng2: 4 });
      expect(res).toHaveLength(2);
      expect(res).toContainEqual(geoloc);
      expect(res).toContainEqual(geolocParent);
    });

    it('return with keywords in english and french', async () => {
      const { item: parentItem } = await saveItemAndMembership({
        item: getDummyItem({ name: 'chat chien', lang: 'fr' }),
        member: actor,
      });
      const { item } = await saveItemAndMembership({
        item: getDummyItem({ name: 'poisson', lang: 'fr' }),
        member: actor,
        parentItem,
      });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'de' };
      await rawRepository.save(geolocParent);

      // noise
      await saveItemAndMembership({ member: actor, parentItem });

      const res = await repository.getItemsIn(
        { ...actor, lang: 'fr' },
        {
          lat1: 0,
          lat2: 4,
          lng1: 0,
          lng2: 4,
          keywords: ['chats'],
        },
      );
      expect(res).toHaveLength(1);
      expect(res).toContainEqual(geolocParent);
    });

    it('return with keywords in english and spanish', async () => {
      const { item: parentItem } = await saveItemAndMembership({
        item: getDummyItem({ name: 'gatos perros', lang: 'es' }),
        member: actor,
      });
      const { item } = await saveItemAndMembership({
        item: getDummyItem({ name: 'poisson', lang: 'fr' }),
        member: actor,
        parentItem,
      });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'de' };
      await rawRepository.save(geolocParent);

      // noise
      await saveItemAndMembership({ member: actor, parentItem });

      const res1 = await repository.getItemsIn(
        { ...actor, lang: 'fr' },
        {
          lat1: 0,
          lat2: 4,
          lng1: 0,
          lng2: 4,
          // this checked the search_document stemmed correctly gatos
          keywords: ['gato'],
        },
      );
      expect(res1).toHaveLength(1);
      expect(res1).toContainEqual(geolocParent);
    });

    it('return only item within keywords in name', async () => {
      const { item: parentItem } = await saveItemAndMembership({
        item: getDummyItem({ name: 'publics private' }),
        member: actor,
      });
      const { item } = await saveItemAndMembership({
        item: getDummyItem({ name: 'private publication' }),
        member: actor,
        parentItem,
      });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'de' };
      await rawRepository.save(geolocParent);

      // noise
      await saveItemAndMembership({ member: actor, parentItem });

      const res = await repository.getItemsIn(actor, {
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
        keywords: ['public', 'private'],
      });
      expect(res).toHaveLength(2);
      expect(res).toContainEqual(geolocParent);
      expect(res).toContainEqual(geoloc);
    });

    it('return only item within keywords in description', async () => {
      const { item: parentItem } = await saveItemAndMembership({
        item: getDummyItem({ description: 'public' }),
        member: actor,
      });
      const { item } = await saveItemAndMembership({
        item: getDummyItem({ description: 'private' }),
        member: actor,
        parentItem,
      });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'de' };
      await rawRepository.save(geolocParent);

      // noise
      await saveItemAndMembership({ member: actor, parentItem });

      const res = await repository.getItemsIn(actor, {
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
        keywords: ['public'],
      });
      expect(res).toHaveLength(1);
      expect(res).toContainEqual(geolocParent);
    });

    it('return only item within keywords in tags', async () => {
      const { item: parentItem } = await saveItemAndMembership({
        item: getDummyItem({ settings: { tags: ['public'] } }),
        member: actor,
      });
      const { item } = await saveItemAndMembership({
        item: getDummyItem({ settings: { tags: ['private'] } }),
        member: actor,
        parentItem,
      });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'de' };
      await rawRepository.save(geolocParent);

      // noise
      await saveItemAndMembership({ member: actor, parentItem });

      const res = await repository.getItemsIn(actor, {
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
        keywords: ['public'],
      });
      expect(res).toHaveLength(1);
      expect(res).toContainEqual(geolocParent);
    });

    it('return only item with keywords in file content', async () => {
      const { item: parentItem } = await saveItemAndMembership({
        member: actor,
      });
      const { item: item1 } = await saveItemAndMembership({
        item: getDummyItem({
          type: ItemType.LOCAL_FILE,
          extra: {
            [ItemType.LOCAL_FILE]: {
              content: 'public',
              name: 'name',
              path: 'path',
              mimetype: 'mimetype',
              size: 1,
            },
          },
        }),
        member: actor,
        parentItem,
      });
      const geoloc = { lat: 1, lng: 2, item: item1, country: 'de' };
      await rawRepository.save(geoloc);
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'de' };
      await rawRepository.save(geolocParent);

      // noise
      await saveItemAndMembership({ member: actor, parentItem });
      const { item: item2 } = await saveItemAndMembership({
        item: getDummyItem({
          type: ItemType.LOCAL_FILE,
          extra: {
            [ItemType.LOCAL_FILE]: {
              content: 'private',
              name: 'name',
              path: 'path',
              mimetype: 'mimetype',
              size: 1,
            },
          },
        }),
        member: actor,
        parentItem,
      });
      await rawRepository.save({ lat: 1, lng: 2, item: item2, country: 'de' });

      const res = await repository.getItemsIn(actor, {
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
        keywords: ['public'],
      });
      expect(res).toHaveLength(1);
      expect(res).toContainEqual(geoloc);
    });

    it('return only item with keywords in s3File content', async () => {
      const { item: parentItem } = await saveItemAndMembership({
        member: actor,
      });
      const { item: item1 } = await saveItemAndMembership({
        item: getDummyItem({
          type: ItemType.S3_FILE,
          extra: {
            [ItemType.S3_FILE]: {
              content: 'public',
              name: 'name',
              path: 'path',
              mimetype: 'mimetype',
              size: 1,
            },
          },
        }),
        member: actor,
      });
      const geoloc = { lat: 1, lng: 2, item: item1, country: 'de' };
      await rawRepository.save(geoloc);
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'de' };
      await rawRepository.save(geolocParent);

      // noise
      await saveItemAndMembership({ member: actor, parentItem });
      const { item: item2 } = await saveItemAndMembership({
        item: getDummyItem({
          type: ItemType.S3_FILE,
          extra: {
            [ItemType.S3_FILE]: {
              content: 'private',
              name: 'name',
              path: 'path',
              mimetype: 'mimetype',
              size: 1,
            },
          },
        }),
        member: actor,
        parentItem,
      });
      await rawRepository.save({ lat: 1, lng: 2, item: item2, country: 'de' });

      const res = await repository.getItemsIn(actor, {
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
        keywords: ['public'],
      });
      expect(res).toHaveLength(1);
      expect(res).toContainEqual(geoloc);
    });

    it('return only item with keywords in document content', async () => {
      const { item: parentItem } = await saveItemAndMembership({
        member: actor,
      });
      const { item: item1 } = await saveItemAndMembership({
        item: getDummyItem({
          type: ItemType.DOCUMENT,
          extra: {
            [ItemType.DOCUMENT]: {
              content: 'public',
            },
          },
        }),
        member: actor,
        parentItem,
      });
      const geoloc = { lat: 1, lng: 2, item: item1, country: 'de' };
      await rawRepository.save(geoloc);
      const geolocParent = { lat: 1, lng: 2, item: parentItem, country: 'de' };
      await rawRepository.save(geolocParent);

      // noise
      await saveItemAndMembership({ member: actor, parentItem });
      const { item: item2 } = await saveItemAndMembership({
        item: getDummyItem({
          type: ItemType.DOCUMENT,
          extra: {
            [ItemType.DOCUMENT]: {
              content: 'private',
            },
          },
        }),
        member: actor,
        parentItem,
      });
      await rawRepository.save({ lat: 1, lng: 2, item: item2, country: 'de' });

      const res = await repository.getItemsIn(actor, {
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
        keywords: ['public'],
      });
      expect(res).toHaveLength(1);
      expect(res).toContainEqual(geoloc);
    });
  });

  describe('put', () => {
    it('create new geolocation for item', async () => {
      const { item } = await saveItemAndMembership({ member: actor });

      const lat = 40.785091;
      const lng = -73.968285;
      await repository.put(item.path, { lat, lng });
      const geoloc = await rawRepository.findOneBy({ lat, lng });
      expect(geoloc).toMatchObject({ lat, lng, country: 'AQ' });
    });
    it('create new geolocation that does not have a country', async () => {
      const { item } = await saveItemAndMembership({ member: actor });

      const lat = 1;
      const lng = 2;
      await repository.put(item.path, { lat, lng });
      const geoloc = await rawRepository.findOneBy({ lat, lng });
      expect(geoloc).toMatchObject({ lat, lng, country: null });
    });
    it('update geolocation', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const geolocParent = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geolocParent);

      const lat = 40.785091;
      const lng = -73.968285;
      await repository.put(item.path, { lat, lng });
      const geoloc = await rawRepository.findOneBy({ lat, lng });
      expect(geoloc).toMatchObject({ lat, lng, country: 'AQ' });
      const allGeoloc = await rawRepository.find();
      expect(allGeoloc).toHaveLength(1);
    });
  });
});
