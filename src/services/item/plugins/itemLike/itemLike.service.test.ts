import { v4 } from 'uuid';

import { db } from '../../../../drizzle/db';
import {
  ItemLikeRaw,
  ItemPublishedWithItemWithCreator,
  ItemWithCreator,
} from '../../../../drizzle/types';
import { MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemLikeRepository } from './itemLike.repository';
import { ItemLikeService } from './itemLike.service';

const authorizedItemService = {
  getItemById: jest.fn() as AuthorizedItemService['getItemById'],
} as AuthorizedItemService;
const meilisearchWrapper = {
  updateItem: jest.fn() as MeiliSearchWrapper['updateItem'],
} as MeiliSearchWrapper;

const itemLikeRepository = {
  addOne: jest.fn() as ItemLikeRepository['addOne'],
  deleteOneByCreatorAndItem: jest.fn() as ItemLikeRepository['deleteOneByCreatorAndItem'],
  getCountByItemId: jest.fn() as ItemLikeRepository['getCountByItemId'],
} as ItemLikeRepository;
const itemMembershipRepository = {
  getForManyItems: jest.fn(async () => {}),
} as unknown as ItemMembershipRepository;
const itemVisibilityRepository = {
  getManyForMany: jest.fn(async () => {}),
} as unknown as ItemVisibilityRepository;
const itemPublishedRepository = {
  getForItem: jest.fn() as ItemPublishedRepository['getForItem'],
} as ItemPublishedRepository;

const itemLikeService = new ItemLikeService(
  authorizedItemService,
  itemLikeRepository,
  itemPublishedRepository,
  itemMembershipRepository,
  itemVisibilityRepository,
  meilisearchWrapper,
);

const MOCK_LIKE = { creatorId: v4(), itemId: v4() } as ItemLikeRaw;

describe('Item Like post', () => {
  afterEach(async () => {
    jest.clearAllMocks();
  });
  it('does not update like count for indexed item if it is not published', async () => {
    jest.spyOn(authorizedItemService, 'getItemById').mockResolvedValue({} as ItemWithCreator);
    jest.spyOn(itemLikeRepository, 'addOne').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = jest.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemLikeService.post(db, {} as MinimalMember, v4());

    expect(updateItemMock).not.toHaveBeenCalled();
  });

  it('update like count for indexed item if it is published', async () => {
    jest.spyOn(authorizedItemService, 'getItemById').mockResolvedValue({} as ItemWithCreator);
    jest.spyOn(itemLikeRepository, 'addOne').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = jest.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    jest
      .spyOn(itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as ItemPublishedWithItemWithCreator);

    await itemLikeService.post(db, {} as MinimalMember, v4());

    expect(updateItemMock).toHaveBeenCalled();
  });
});

describe('Item Like removeOne', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('do not update like count for indexed item if it is not published', async () => {
    jest.spyOn(authorizedItemService, 'getItemById').mockResolvedValue({} as ItemWithCreator);
    jest.spyOn(itemLikeRepository, 'deleteOneByCreatorAndItem').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = jest.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemLikeService.removeOne(db, {} as MinimalMember, v4());

    expect(updateItemMock).not.toHaveBeenCalled();
  });

  it('update like count for indexed item if it is published', async () => {
    jest.spyOn(authorizedItemService, 'getItemById').mockResolvedValue({} as ItemWithCreator);
    jest.spyOn(itemLikeRepository, 'deleteOneByCreatorAndItem').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = jest.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    jest
      .spyOn(itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as ItemPublishedWithItemWithCreator);

    await itemLikeService.removeOne(db, {} as MinimalMember, v4());

    expect(updateItemMock).toHaveBeenCalled();
  });
});
