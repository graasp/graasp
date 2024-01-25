import build, { clearDatabase } from '../../../../../test/app';
import { AppDataSource } from '../../../../plugins/datasource';
import { saveItemAndMembership } from '../../../itemMembership/test/fixtures/memberships';
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

      const res = await repository.getItemsIn(0, 4, 0, 4);
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

      const res = await repository.getItemsIn(0, 0.5, 0, 0.5);
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

      const res = await repository.getItemsIn(4, 0, 4, 0);
      expect(res).toHaveLength(2);
      expect(res).toContainEqual(geoloc);
      expect(res).toContainEqual(geolocParent);
    });
  });

  describe('put', () => {
    it('create new geolocation for item', async () => {
      const { item } = await saveItemAndMembership({ member: actor });

      const lat = 40.785091;
      const lng = -73.968285;
      await repository.put(item.path, lat, lng);
      const geoloc = await rawRepository.findOneBy({ lat, lng });
      expect(geoloc).toMatchObject({ lat, lng, country: 'AQ' });
    });
    it('create new geolocation that does not have a country', async () => {
      const { item } = await saveItemAndMembership({ member: actor });

      const lat = 1;
      const lng = 2;
      await repository.put(item.path, lat, lng);
      const geoloc = await rawRepository.findOneBy({ lat, lng });
      expect(geoloc).toMatchObject({ lat, lng, country: null });
    });
    it('update geolocation', async () => {
      const { item } = await saveItemAndMembership({ member: actor });
      const geolocParent = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geolocParent);

      const lat = 40.785091;
      const lng = -73.968285;
      await repository.put(item.path, lat, lng);
      const geoloc = await rawRepository.findOneBy({ lat, lng });
      expect(geoloc).toMatchObject({ lat, lng, country: 'AQ' });
      const allGeoloc = await rawRepository.find();
      expect(allGeoloc).toHaveLength(1);
    });
  });
});
