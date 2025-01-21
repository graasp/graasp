import { DataSource, Repository } from 'typeorm';

import { FolderItemFactory, MemberFactory, PermissionLevel } from '@graasp/sdk';

import { AppDataSource } from '../../../../../../plugins/datasource';
import { ItemMembership } from '../../../../../itemMembership/entities/ItemMembership';
import { Member } from '../../../../../member/entities/member';
import { Item } from '../../../../entities/Item';
import { expectManyItems } from '../../../../test/fixtures/items';
import { ItemPublished } from '../entities/itemPublished';
import { ItemPublishedRepository } from './itemPublished';

describe('ItemPublishedRepository', () => {
  let db: DataSource;
  let repository: ItemPublishedRepository;
  let rawRepository: Repository<ItemPublished>;
  let itemRawRepository: Repository<Item>;
  let memberRawRepository: Repository<Member>;
  let itemMembershipRawRepository: Repository<ItemMembership>;

  beforeAll(async () => {
    db = await AppDataSource.initialize();
    await db.runMigrations();
    repository = new ItemPublishedRepository(db.manager);
    rawRepository = db.getRepository(ItemPublished);
    itemRawRepository = db.getRepository(Item);
    memberRawRepository = db.getRepository(Member);
    itemMembershipRawRepository = db.getRepository(ItemMembership);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await db.destroy();
  });

  describe('getForMember', () => {
    it('get published items for member', async () => {
      const creator = await memberRawRepository.save(MemberFactory());
      const items = [
        await itemRawRepository.save(FolderItemFactory({ creator })),
        await itemRawRepository.save(FolderItemFactory({ creator })),
        await itemRawRepository.save(FolderItemFactory({ creator })),
      ];
      for (const i of items) {
        await itemMembershipRawRepository.save({
          item: { path: i.path },
          account: { id: creator.id },
          permission: PermissionLevel.Admin,
        });
        await rawRepository.save({
          item: { path: i.path },
        });
      }

      const result = await repository.getForMember(creator.id);
      expectManyItems(result, items);
    });
  });

  describe('touchUpdatedAt', () => {
    it('undefined path throws', async () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await expect(() => repository.touchUpdatedAt(undefined)).rejects.toThrow();
    });
    it('update updatedAt on current time', async () => {
      const updatedAt = new Date();
      const creator = await memberRawRepository.save(MemberFactory());
      const item = await itemRawRepository.save(FolderItemFactory({ creator }));

      const result = await repository.touchUpdatedAt(item.path);

      expect(new Date(result).getTime() - new Date(updatedAt).getTime()).toBeLessThanOrEqual(200);
    });
  });
});
