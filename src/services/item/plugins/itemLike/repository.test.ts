import { DataSource, Repository } from 'typeorm';
import { v4 } from 'uuid';

import { FolderItemFactory, MemberFactory } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { IllegalArgumentException } from '../../../../repositories/errors';
import { Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import { ItemLike } from './itemLike';
import { ItemLikeRepository } from './repository';

describe('Tag Repository', () => {
  let db: DataSource;

  let repository: ItemLikeRepository;
  let likeRawRepository: Repository<ItemLike>;
  let itemRawRepository: Repository<Item>;
  let memberRawRepository: Repository<Member>;

  beforeAll(async () => {
    db = await AppDataSource.initialize();
    await db.runMigrations();
    repository = new ItemLikeRepository(db.manager);
    likeRawRepository = db.getRepository(ItemLike);
    itemRawRepository = db.getRepository(Item);
    memberRawRepository = db.getRepository(Member);
  });

  afterAll(async () => {
    await db.dropDatabase();
    await db.destroy();
  });

  describe('getCountForItemId', () => {
    it('throw for invalid id', async () => {
      await expect(() => repository.getCountForItemId(undefined!)).rejects.toBeInstanceOf(
        IllegalArgumentException,
      );
    });
    it('Return 0 for non-existing item', async () => {
      expect(await repository.getCountForItemId(v4())).toEqual(0);
    });
    it('Return 0 for no like for item', async () => {
      expect(await repository.getCountForItemId(v4())).toEqual(0);
    });
    it('get like count', async () => {
      const item = await itemRawRepository.save(FolderItemFactory({ creator: null }));
      const creator = await memberRawRepository.save(MemberFactory());
      await likeRawRepository.save({ item, creator });
      const creator1 = await memberRawRepository.save(MemberFactory());
      await likeRawRepository.save({ item, creator: creator1 });

      expect(await repository.getCountForItemId(item.id)).toEqual(2);
    });
  });
});
