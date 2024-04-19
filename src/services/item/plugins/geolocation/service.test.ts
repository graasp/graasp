import { v4 } from 'uuid';

import { FastifyBaseLogger } from 'fastify';

import { PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { AppDataSource } from '../../../../plugins/datasource';
import { ItemNotFound, MemberCannotAccess, MemberCannotWriteItem } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { saveMember } from '../../../member/test/fixtures/members';
import { ThumbnailService } from '../../../thumbnail/service';
import ItemService from '../../service';
import { ItemTestUtils } from '../../test/fixtures/items';
import { ItemGeolocation } from './ItemGeolocation';
import { expectItemGeolocations, saveGeolocation } from './index.test';
import { ItemGeolocationService } from './service';

// mock datasource
jest.mock('../../../../plugins/datasource');
const testUtils = new ItemTestUtils();

const service = new ItemGeolocationService(
  new ItemService({} as unknown as ThumbnailService, {} as unknown as FastifyBaseLogger),
  'geolocation-key',
);
const rawRepository = AppDataSource.getRepository(ItemGeolocation);

describe('ItemGeolocationService', () => {
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

  describe('delete', () => {
    it('delete successfully with admin permission', async () => {
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);

      await service.delete(actor, buildRepositories(), item.id);

      expect(await rawRepository.count()).toEqual(0);
    });
    it('delete successfully with write permission', async () => {
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        permission: PermissionLevel.Write,
        creator: member,
      });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);

      await service.delete(actor, buildRepositories(), item.id);

      expect(await rawRepository.count()).toEqual(0);
    });
    it('cannot delete with read permission', async () => {
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        permission: PermissionLevel.Read,
        creator: member,
      });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);

      await service
        .delete(actor, buildRepositories(), item.id)
        .then(() => {
          throw new Error('This should have throw');
        })
        .catch((e) => {
          expect(e).toMatchObject(new MemberCannotWriteItem(expect.anything()));
        });

      expect(await rawRepository.count()).toEqual(1);
    });
    it('cannot delete without permission', async () => {
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({
        member,
        permission: PermissionLevel.Read,
      });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);

      await service.delete(actor, buildRepositories(), item.id).catch((e) => {
        expect(e).toMatchObject(new MemberCannotAccess(expect.anything()));
      });

      expect(await rawRepository.count()).toEqual(1);
    });

    it('throws if item not found', async () => {
      await service
        .delete(actor, buildRepositories(), v4())
        .then(() => {
          throw new Error('This should have throw');
        })
        .catch((e) => {
          expect(e).toMatchObject(new ItemNotFound(expect.anything()));
        });
    });
  });

  describe('getByItem', () => {
    it('get successfully with read permission', async () => {
      const member = await saveMember();
      const { packedItem: item } = await testUtils.saveItemAndMembership({
        member: actor,
        creator: member,
        permission: PermissionLevel.Read,
      });
      const { packed: geoloc } = await saveGeolocation({ lat: 1, lng: 2, item, country: 'de' });

      const res = await service.getByItem(actor, buildRepositories(), item.id);
      expectItemGeolocations([res!], [geoloc]);
    });

    it('get successfully for public item', async () => {
      const member = await saveMember();
      const item = await testUtils.savePublicItem({
        actor: member,
      });
      const { packed: geoloc } = await saveGeolocation({
        lat: 1,
        lng: 2,
        item: { ...item, permission: null },
        country: 'de',
      });

      const res = await service.getByItem(actor, buildRepositories(), item.id);
      expectItemGeolocations([res!], [geoloc]);
    });

    it('return null if does not have geolocation', async () => {
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        permission: PermissionLevel.Read,
      });

      const res = await service.getByItem(actor, buildRepositories(), item.id);

      expect(res).toBeNull();
    });

    it('throws if item not found', async () => {
      await service
        .getByItem(actor, buildRepositories(), v4())
        .then(() => {
          throw new Error('This should have throw');
        })
        .catch((e) => {
          expect(e).toMatchObject(new ItemNotFound(expect.anything()));
        });
    });
  });

  describe('getIn', () => {
    it('get successfully with read permission', async () => {
      const member = await saveMember();
      const { packedItem: item1 } = await testUtils.saveItemAndMembership({
        member: actor,
        creator: member,
        permission: PermissionLevel.Read,
      });
      const { packed: geoloc1 } = await saveGeolocation({
        lat: 1,
        lng: 2,
        item: item1,
        country: 'de',
      });
      const { packedItem: item2 } = await testUtils.saveItemAndMembership({
        member: actor,
        creator: member,
        permission: PermissionLevel.Read,
      });
      const { packed: geoloc2 } = await saveGeolocation({
        lat: 1,
        lng: 2,
        item: item2,
        country: 'de',
      });

      // noise
      const { packedItem: item3 } = await testUtils.saveItemAndMembership({
        member: actor,
        creator: member,
        permission: PermissionLevel.Read,
      });
      await saveGeolocation({ lat: 1, lng: 6, item: item3, country: 'de' });

      const res = await service.getIn(actor, buildRepositories(), {
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
      });
      expect(res).toHaveLength(2);
      expectItemGeolocations(res, [geoloc1, geoloc2]);
    });

    it('get successfully for public item', async () => {
      const member = await saveMember();
      const { packedItem: item1 } = await testUtils.saveItemAndMembership({
        member: actor,
        creator: member,
        permission: PermissionLevel.Read,
      });
      const { packed: geoloc1 } = await saveGeolocation({
        lat: 1,
        lng: 2,
        item: item1,
        country: 'de',
      });
      const publicItem = await testUtils.savePublicItem({
        actor: member,
      });
      const { packed: geoloc2 } = await saveGeolocation({
        lat: 1,
        lng: 2,
        item: { ...publicItem, permission: null },
        country: 'de',
      });

      // noise
      const publicItem1 = await testUtils.savePublicItem({
        actor: member,
      });
      await saveGeolocation({
        lat: 1,
        lng: 6,
        item: { ...publicItem1, permission: null },
        country: 'de',
      });

      const res = await service.getIn(actor, buildRepositories(), {
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
      });
      expect(res).toHaveLength(2);
      expectItemGeolocations(res, [geoloc1, geoloc2]);
    });

    it('return empty for nothing in box', async () => {
      // noise
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        creator: member,
        permission: PermissionLevel.Read,
      });
      const geoloc = { lat: 1, lng: 6, item, country: 'de' };
      await rawRepository.save(geoloc);

      const res = await service.getIn(actor, buildRepositories(), {
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
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
      });

      await service.put(actor, buildRepositories(), item.id, { lat: 1, lng: 2 });
      const all = await ItemGeolocation.find();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ lat: 1, lng: 2 });
    });

    it('save successfully for write permission', async () => {
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        creator: member,
        permission: PermissionLevel.Write,
      });

      await service.put(actor, buildRepositories(), item.id, { lat: 1, lng: 2 });
      const all = await ItemGeolocation.find();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ lat: 1, lng: 2 });
    });

    it('throws for read permission', async () => {
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        creator: member,
        permission: PermissionLevel.Read,
      });

      await service.put(actor, buildRepositories(), item.id, { lat: 1, lng: 2 }).catch((e) => {
        expect(e).toMatchObject(new MemberCannotWriteItem(expect.anything()));
      });
    });

    it('throws if item not found', async () => {
      await service
        .put(actor, buildRepositories(), v4(), { lat: 1, lng: 2 })
        .then(() => {
          throw new Error('This should have throw');
        })
        .catch((e) => {
          expect(e).toMatchObject(new ItemNotFound(expect.anything()));
        });
    });
  });
});
