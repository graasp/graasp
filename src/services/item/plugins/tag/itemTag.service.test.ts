import { EnqueuedTask } from 'meilisearch';
import { v4 } from 'uuid';

import { TagFactory } from '@graasp/sdk';

import { client, db } from '../../../../drizzle/db';
import {
  ItemPublishedWithItemWithCreator,
  ItemWithCreator,
  TagRaw,
} from '../../../../drizzle/types';
import { MinimalMember } from '../../../../types';
import { TagRepository } from '../../../tag/tag.repository';
import { BasicItemService } from '../../basic.service';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemTagRepository } from './ItemTag.repository';
import { ItemTagService } from './itemTag.service';

const itemService = { get: jest.fn() as BasicItemService['get'] } as BasicItemService;
const meilisearchWrapper = {
  indexOne: jest.fn() as MeiliSearchWrapper['indexOne'],
} as MeiliSearchWrapper;

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

const itemTagService = new ItemTagService(
  itemService,
  tagRepository,
  itemTagRepository,
  itemPublishedRepository,
  meilisearchWrapper,
);

describe('Item Tag create', () => {
  beforeAll(async () => {
    await client.connect();
  });
  afterAll(() => {
    client.end();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('does not index item if it is not published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as ItemWithCreator);
    jest.spyOn(itemTagRepository, 'create').mockResolvedValue();
    const indexOneMock = jest
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemTagService.create(db, {} as MinimalMember, v4(), TagFactory());

    expect(indexOneMock).not.toHaveBeenCalled();
  });

  it('index item if it is published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as ItemWithCreator);
    jest.spyOn(itemTagRepository, 'create').mockResolvedValue();
    const indexOneMock = jest
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    jest
      .spyOn(itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as ItemPublishedWithItemWithCreator);

    await itemTagService.create(db, {} as MinimalMember, v4(), TagFactory());

    expect(indexOneMock).toHaveBeenCalled();
  });
});

describe('Item Tag delete', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('does not index item if it is not published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as ItemWithCreator);
    jest.spyOn(itemTagRepository, 'delete').mockResolvedValue();
    const indexOneMock = jest
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    jest.spyOn(itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemTagService.delete(db, {} as MinimalMember, v4(), v4());

    expect(indexOneMock).not.toHaveBeenCalled();
  });

  it('index item if it is published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as ItemWithCreator);
    jest.spyOn(itemTagRepository, 'delete').mockResolvedValue();
    const indexOneMock = jest
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    jest
      .spyOn(itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as ItemPublishedWithItemWithCreator);

    await itemTagService.delete(db, {} as MinimalMember, v4(), v4());

    expect(indexOneMock).toHaveBeenCalled();
  });
});
