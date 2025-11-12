import { v4 } from 'uuid';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { db } from '../../../../drizzle/db';
import type {
  ItemLikeRaw,
  ItemPublishedWithItemWithCreator,
  ItemWithCreator,
} from '../../../../drizzle/types';
import type { MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemLikeRepository } from './itemLike.repository';
import { ItemLikeService } from './itemLike.service';

const authorizedItemService = {
  getItemById: vi.fn() as AuthorizedItemService['getItemById'],
} as AuthorizedItemService;
const meilisearchWrapper = {
  updateItem: vi.fn() as MeiliSearchWrapper['updateItem'],
} as MeiliSearchWrapper;

const itemLikeRepository = {
  addOne: vi.fn() as ItemLikeRepository['addOne'],
  deleteOneByCreatorAndItem: vi.fn() as ItemLikeRepository['deleteOneByCreatorAndItem'],
  getCountByItemId: vi.fn() as ItemLikeRepository['getCountByItemId'],
} as ItemLikeRepository;
const itemMembershipRepository = {
  getForManyItems: vi.fn(async () => {}),
} as unknown as ItemMembershipRepository;
const itemVisibilityRepository = {
  getManyForMany: vi.fn(async () => {}),
} as unknown as ItemVisibilityRepository;
const itemPublishedRepository = {
  getForItem: vi.fn() as ItemPublishedRepository['getForItem'],
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
    vi.clearAllMocks();
  });
  it('does not update like count for indexed item if it is not published', async () => {
    vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValue({} as ItemWithCreator);
    vi.spyOn(itemLikeRepository, 'addOne').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = vi.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    vi.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemLikeService.post(db, {} as MinimalMember, v4());

    expect(updateItemMock).not.toHaveBeenCalled();
  });

  it('update like count for indexed item if it is published', async () => {
    vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValue({} as ItemWithCreator);
    vi.spyOn(itemLikeRepository, 'addOne').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = vi.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    vi.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(
      {} as ItemPublishedWithItemWithCreator,
    );

    await itemLikeService.post(db, {} as MinimalMember, v4());

    expect(updateItemMock).toHaveBeenCalled();
  });
});

describe('Item Like removeOne', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });
  it('do not update like count for indexed item if it is not published', async () => {
    vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValue({} as ItemWithCreator);
    vi.spyOn(itemLikeRepository, 'deleteOneByCreatorAndItem').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = vi.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    vi.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemLikeService.removeOne(db, {} as MinimalMember, v4());

    expect(updateItemMock).not.toHaveBeenCalled();
  });

  it('update like count for indexed item if it is published', async () => {
    vi.spyOn(authorizedItemService, 'getItemById').mockResolvedValue({} as ItemWithCreator);
    vi.spyOn(itemLikeRepository, 'deleteOneByCreatorAndItem').mockResolvedValue(MOCK_LIKE);
    const updateItemMock = vi.spyOn(meilisearchWrapper, 'updateItem').mockResolvedValue();
    vi.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(
      {} as ItemPublishedWithItemWithCreator,
    );

    await itemLikeService.removeOne(db, {} as MinimalMember, v4());

    expect(updateItemMock).toHaveBeenCalled();
  });
});
