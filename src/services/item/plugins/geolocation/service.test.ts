import { v4 } from 'uuid';

import { FastifyInstance } from 'fastify';

import { PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { BaseLogger } from '../../../../logger';
import { AppDataSource } from '../../../../plugins/datasource';
import { assertIsDefined } from '../../../../utils/assertions';
import { ItemNotFound, MemberCannotAccess, MemberCannotWriteItem } from '../../../../utils/errors';
import { buildRepositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { saveMember } from '../../../member/test/fixtures/members';
import { ThumbnailService } from '../../../thumbnail/service';
import { ItemWrapper } from '../../ItemWrapper';
import { ItemService } from '../../service';
import { ItemTestUtils } from '../../test/fixtures/items';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { StubItemThumbnailService } from '../thumbnail/test/fixtures/itemThumbnailService';
import { ItemGeolocation } from './ItemGeolocation';
import { ItemGeolocationService } from './service';
import { expectPackedItemGeolocations, saveGeolocation } from './test/utils';

const testUtils = new ItemTestUtils();
const stubItemThumbnailService = StubItemThumbnailService();

const service = new ItemGeolocationService(
  new ItemService(
    {} as ThumbnailService,
    stubItemThumbnailService,
    {} as MeiliSearchWrapper,
    {} as BaseLogger,
  ),
  stubItemThumbnailService,
  'geolocation-key',
);
const rawRepository = AppDataSource.getRepository(ItemGeolocation);

describe('ItemGeolocationService', () => {
  let app: FastifyInstance;
  let actor: Member | undefined;

  beforeEach(async () => {
    ({ app, actor } = await build());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = undefined;
    app.close();
  });

  describe('delete', () => {
    it('delete successfully with admin permission', async () => {
      assertIsDefined(actor);
      const { item } = await testUtils.saveItemAndMembership({ member: actor });
      const geoloc = { lat: 1, lng: 2, item, country: 'de' };
      await rawRepository.save(geoloc);

      await service.delete(actor, buildRepositories(), item.id);

      expect(await rawRepository.count()).toEqual(0);
    });
    it('delete successfully with write permission', async () => {
      assertIsDefined(actor);
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
      assertIsDefined(actor);
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
      assertIsDefined(actor);
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
      assertIsDefined(actor);
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
      expectPackedItemGeolocations([res!], [geoloc]);
    });

    it('get successfully for public item', async () => {
      const member = await saveMember();
      const { item } = await testUtils.savePublicItem({ member });
      const { packed: geoloc } = await saveGeolocation({
        lat: 1,
        lng: 2,
        item: new ItemWrapper(item, null).packed(),
        country: 'de',
      });

      const res = await service.getByItem(actor, buildRepositories(), item.id);
      expectPackedItemGeolocations([res!], [geoloc]);
    });

    it('return inherited geoloc', async () => {
      const { packedItem: parentItem, item: pi } = await testUtils.saveItemAndMembership({
        member: actor,
        permission: PermissionLevel.Read,
      });
      const item = await testUtils.saveItem({ parentItem: pi });
      const { packed: geoloc } = await saveGeolocation({
        lat: 1,
        lng: 2,
        item: parentItem,
        country: 'de',
      });

      const res = await service.getByItem(actor, buildRepositories(), item.id);

      expectPackedItemGeolocations([res!], [geoloc]);
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
      expectPackedItemGeolocations(res, [geoloc1, geoloc2]);
    });

    it('ignore public root item', async () => {
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
      const { item: publicItem } = await testUtils.savePublicItem({ member });

      // public root item - should be ignored
      await saveGeolocation({
        lat: 1,
        lng: 2,
        item: new ItemWrapper(publicItem, null).packed(),
        country: 'de',
      });

      // noise
      const { item: publicItem1 } = await testUtils.savePublicItem({ member });
      await saveGeolocation({
        lat: 1,
        lng: 6,
        item: new ItemWrapper(publicItem1, null).packed(),
        country: 'de',
      });

      const res = await service.getIn(actor, buildRepositories(), {
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
      });
      expect(res).toHaveLength(1);
      expectPackedItemGeolocations(res, [geoloc1]);
    });

    it('get successfully inside public item', async () => {
      const member = await saveMember();
      const { item: publicItem } = await testUtils.savePublicItem({ member });
      const { packed: geoloc } = await saveGeolocation({
        lat: 1,
        lng: 2,
        item: new ItemWrapper(publicItem, null).packed(),
        country: 'de',
      });

      const res = await service.getIn(actor, buildRepositories(), {
        parentItemId: publicItem.id,
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
      });
      expect(res).toHaveLength(1);
      expectPackedItemGeolocations(res, [geoloc]);
    });

    it('get successfully geolocalized child in public item', async () => {
      const member = await saveMember();
      const { item: publicItem } = await testUtils.savePublicItem({ member });
      const child = await testUtils.saveItem({
        actor: member,
        parentItem: publicItem,
      });
      const { packed: geoloc } = await saveGeolocation({
        lat: 1,
        lng: 2,
        item: new ItemWrapper(child, null).packed(),
        country: 'de',
      });

      const res = await service.getIn(actor, buildRepositories(), {
        parentItemId: publicItem.id,
        lat1: 0,
        lat2: 4,
        lng1: 0,
        lng2: 4,
      });
      expect(res).toHaveLength(1);
      expectPackedItemGeolocations(res, [geoloc]);
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
      assertIsDefined(actor);
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
      });

      await service.put(actor, buildRepositories(), item.id, { lat: 1, lng: 2 });
      const all = await ItemGeolocation.find();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ lat: 1, lng: 2 });
    });

    it('save successfully for write permission', async () => {
      assertIsDefined(actor);
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
      assertIsDefined(actor);
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
      assertIsDefined(actor);
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
