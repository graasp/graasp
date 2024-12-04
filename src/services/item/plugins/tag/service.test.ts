import { EnqueuedTask } from 'meilisearch';
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
import { ItemTagRepository } from './ItemTag.repository';
import { ItemTagService } from './service';

const itemService = { get: jest.fn() as ItemService['get'] } as ItemService;
const meilisearchWrapper = {
  indexOne: jest.fn() as MeiliSearchWrapper['indexOne'],
} as MeiliSearchWrapper;

const itemTagService = new ItemTagService(itemService, meilisearchWrapper);

const repositories = {
  itemTagRepository: {
    create: jest.fn() as ItemTagRepository['create'],
    delete: jest.fn() as ItemTagRepository['delete'],
  } as ItemTagRepository,
  tagRepository: {
    addOneIfDoesNotExist: jest.fn(async () => TagFactory() as Tag),
  } as unknown as TagRepository,
  itemPublishedRepository: {
    getForItem: jest.fn() as ItemPublishedRepository['getForItem'],
  } as ItemPublishedRepository,
} as Repositories;

describe('Item Tag create', () => {
  it('does not index item if it is not published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(repositories.itemTagRepository, 'create').mockResolvedValue();
    const indexOneMock = jest
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    jest.spyOn(repositories.itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemTagService.create({} as Member, repositories, v4(), TagFactory());

    expect(indexOneMock).not.toHaveBeenCalled();
  });

  it('index item if it is published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(repositories.itemTagRepository, 'create').mockResolvedValue();
    const indexOneMock = jest
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    jest
      .spyOn(repositories.itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as unknown as ItemPublished);

    await itemTagService.create({} as Member, repositories, v4(), TagFactory());

    expect(indexOneMock).toHaveBeenCalled();
  });
});

describe('Item Tag delete', () => {
  it('does not index item if it is not published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(repositories.itemTagRepository, 'delete').mockResolvedValue();
    const indexOneMock = jest
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    jest.spyOn(repositories.itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemTagService.delete({} as Member, repositories, v4(), v4());

    expect(indexOneMock).not.toHaveBeenCalled();
  });

  it('index item if it is published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(repositories.itemTagRepository, 'delete').mockResolvedValue();
    const indexOneMock = jest
      .spyOn(meilisearchWrapper, 'indexOne')
      .mockResolvedValue({} as unknown as EnqueuedTask);
    jest
      .spyOn(repositories.itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as unknown as ItemPublished);

    await itemTagService.delete({} as Member, repositories, v4(), v4());

    expect(indexOneMock).toHaveBeenCalled();
  });
});
