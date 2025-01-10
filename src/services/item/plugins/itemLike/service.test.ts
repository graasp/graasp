import { v4 } from 'uuid';

import { TagFactory } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { Tag } from '../../../tag/Tag.entity';
import { TagRepository } from '../../../tag/Tag.repository';
import { Item } from '../../entities/Item';
import { ItemService } from '../../service';
import { ItemPublished } from '../publication/published/entities/itemPublished';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemPublishedRepository } from '../publication/published/repositories/itemPublished';
import { ItemLike } from './itemLike';
import { ItemLikeRepository } from './repository';
import { ItemLikeService } from './service';

const itemService = { get: jest.fn() as ItemService['get'] } as ItemService;
const meilisearchWrapper = {
  updateItem: jest.fn() as MeiliSearchWrapper['updateItem'],
} as MeiliSearchWrapper;

const itemLikeService = new ItemLikeService(itemService, meilisearchWrapper);

const repositories = {
  itemLikeRepository: {
    addOne: jest.fn() as ItemLikeRepository['addOne'],
    deleteOneByCreatorAndItem: jest.fn() as ItemLikeRepository['deleteOneByCreatorAndItem'],
    getCountForItemId: jest.fn() as ItemLikeRepository['getCountForItemId'],
  } as ItemLikeRepository,
  tagRepository: {
    addOneIfDoesNotExist: jest.fn(async () => TagFactory() as Tag),
  } as unknown as TagRepository,
  itemPublishedRepository: {
    getForItem: jest.fn() as ItemPublishedRepository['getForItem'],
  } as ItemPublishedRepository,
} as Repositories;

const MOCK_LIKE = { creator: { id: v4() }, item: { id: v4() } } as ItemLike;

describe('Item Like post', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('does not update like count for indexed item if it is not published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(repositories.itemLikeRepository, 'addOne').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = jest.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    jest.spyOn(repositories.itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemLikeService.post({} as Member, repositories, v4());

    expect(updateItemMock).not.toHaveBeenCalled();
  });

  it('update like count for indexed item if it is published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(repositories.itemLikeRepository, 'addOne').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = jest.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    jest
      .spyOn(repositories.itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as unknown as ItemPublished);

    await itemLikeService.post({} as Member, repositories, v4());

    expect(updateItemMock).toHaveBeenCalled();
  });
});

describe('Item Like removeOne', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('do not update like count for indexed item if it is not published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest
      .spyOn(repositories.itemLikeRepository, 'deleteOneByCreatorAndItem')
      .mockResolvedValue(MOCK_LIKE);
    const updateItemMock = jest.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    jest.spyOn(repositories.itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemLikeService.removeOne({} as Member, repositories, v4());

    expect(updateItemMock).not.toHaveBeenCalled();
  });

  it('update like count for indexed item if it is published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest
      .spyOn(repositories.itemLikeRepository, 'deleteOneByCreatorAndItem')
      .mockResolvedValue(MOCK_LIKE);
    const updateItemMock = jest.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    jest
      .spyOn(repositories.itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as unknown as ItemPublished);

    await itemLikeService.removeOne({} as Member, repositories, v4());

    expect(updateItemMock).toHaveBeenCalled();
  });
});
