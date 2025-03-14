import { EnqueuedTask } from 'meilisearch';
import { v4 } from 'uuid';

import { TagFactory } from '@graasp/sdk';

import { Item, ItemPublishedRaw, TagRaw } from '../../../../drizzle/types.js';
import { MinimalMember } from '../../../../types.js';
import { TagRepository } from '../../../tag/Tag.repository.js';
import { ItemService } from '../../service.js';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository.js';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch.js';
import { ItemTagRepository } from './ItemTag.repository.js';
import { ItemTagService } from './service.js';

const itemService = { get: jest.fn() as ItemService['get'] } as ItemService;
const meilisearchWrapper = {
  indexOne: jest.fn() as MeiliSearchWrapper['indexOne'],
} as MeiliSearchWrapper;

const itemTagService = new ItemTagService(itemService, meilisearchWrapper);

const itemTagRepository = {
  create: jest.fn() as ItemTagRepository['create'],
  delete: jest.fn() as ItemTagRepository['delete'],
} as ItemTagRepository;
const tagRepository = {
  addOneIfDoesNotExist: jest.fn(async () => TagFactory() as TagRaw),
} as unknown as TagRepository;
const itemPublishedRepository = {
  getForItem: jest.fn() as ItemPublishedRepository['getForItem'],
} as ItemPublishedRepository;

describe('Item Tag create', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('does not index item if it is not published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(itemTagRepository, 'create').mockResolvedValue();
    const indexOneMock = jest
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemTagService.create(app.db, {} as MinimalMember, v4(), TagFactory());

    expect(indexOneMock).not.toHaveBeenCalled();
  });

  it('index item if it is published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(itemTagRepository, 'create').mockResolvedValue();
    const indexOneMock = jest
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    jest
      .spyOn(itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as unknown as ItemPublishedRaw);

    await itemTagService.create(app.db, {} as MinimalMember, v4(), TagFactory());

    expect(indexOneMock).toHaveBeenCalled();
  });
});

describe('Item Tag delete', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('does not index item if it is not published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(itemTagRepository, 'delete').mockResolvedValue();
    const indexOneMock = jest
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemTagService.delete(app.db, {} as MinimalMember, v4(), v4());

    expect(indexOneMock).not.toHaveBeenCalled();
  });

  it('index item if it is published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(itemTagRepository, 'delete').mockResolvedValue();
    const indexOneMock = jest
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    jest
      .spyOn(itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as unknown as ItemPublished);

    await itemTagService.delete(app.db, {} as MinimalMember, v4(), v4());

    expect(indexOneMock).toHaveBeenCalled();
  });
});
