import { v4 } from 'uuid';

import { TagFactory } from '@graasp/sdk';

import { Item, ItemLikeRaw, ItemPublishedRaw, TagRaw } from '../../../../drizzle/types.js';
import { TagRepository } from '../../../tag/Tag.repository.js';
import { ItemService } from '../../service.js';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository.js';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch.js';
import { ItemLikeRepository } from './itemLike.repository.js';
import { ItemLikeService } from './service.js';

const itemService = { get: jest.fn() as ItemService['get'] } as ItemService;
const meilisearchWrapper = {
  updateItem: jest.fn() as MeiliSearchWrapper['updateItem'],
} as MeiliSearchWrapper;

const itemLikeService = new ItemLikeService(itemService, meilisearchWrapper);

const itemLikeRepository = {
  addOne: jest.fn() as ItemLikeRepository['addOne'],
  deleteOneByCreatorAndItem: jest.fn() as ItemLikeRepository['deleteOneByCreatorAndItem'],
  getCountByItemId: jest.fn() as ItemLikeRepository['getCountByItemId'],
} as ItemLikeRepository;
const tagRepository = {
  addOneIfDoesNotExist: jest.fn(async () => TagFactory() as TagRaw),
} as unknown as TagRepository;
const itemPublishedRepository = {
  getForItem: jest.fn() as ItemPublishedRepository['getForItem'],
} as ItemPublishedRepository;

const MOCK_LIKE = { creator: { id: v4() }, item: { id: v4() } } as ItemLikeRaw;

describe('Item Like post', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('does not update like count for indexed item if it is not published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(itemLikeRepository, 'addOne').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = jest.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemLikeService.post(app.db, {} as Member, v4());

    expect(updateItemMock).not.toHaveBeenCalled();
  });

  it('update like count for indexed item if it is published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(itemLikeRepository, 'addOne').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = jest.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    jest
      .spyOn(itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as unknown as ItemPublishedRaw);

    await itemLikeService.post(app.db, {} as Member, v4());

    expect(updateItemMock).toHaveBeenCalled();
  });
});

describe('Item Like removeOne', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('do not update like count for indexed item if it is not published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(itemLikeRepository, 'deleteOneByCreatorAndItem').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = jest.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemLikeService.removeOne(app.db, {} as Member, v4());

    expect(updateItemMock).not.toHaveBeenCalled();
  });

  it('update like count for indexed item if it is published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(itemLikeRepository, 'deleteOneByCreatorAndItem').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = jest.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    jest
      .spyOn(itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as unknown as ItemPublishedRaw);

    await itemLikeService.removeOne(app.db, {} as Member, v4());

    expect(updateItemMock).toHaveBeenCalled();
  });
});
