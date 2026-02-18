import { v4 } from 'uuid';

import { TagFactory } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { Tag } from '../../../tag/Tag.entity';
import { TagRepository } from '../../../tag/Tag.repository';
import { Item } from '../../entities/Item';
import { ItemService } from '../../service';
import { ItemPublished } from '../publication/published/entities/itemPublished';
import { ItemPublishedRepository } from '../publication/published/repositories/itemPublished';
import { ItemTagRepository } from './ItemTag.repository';
import { ItemTagService } from './service';

const itemService = { get: jest.fn() as ItemService['get'] } as ItemService;

const itemTagService = new ItemTagService(itemService);

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
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('does not index item if it is not published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(repositories.itemTagRepository, 'create').mockResolvedValue();
    jest.spyOn(repositories.itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemTagService.create({} as Member, repositories, v4(), TagFactory());
  });

  it('index item if it is published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(repositories.itemTagRepository, 'create').mockResolvedValue();
    jest
      .spyOn(repositories.itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as unknown as ItemPublished);

    await itemTagService.create({} as Member, repositories, v4(), TagFactory());
  });
});

describe('Item Tag delete', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  it('does not index item if it is not published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(repositories.itemTagRepository, 'delete').mockResolvedValue();
    jest.spyOn(repositories.itemPublishedRepository, 'getForItem').mockResolvedValue(null);

    await itemTagService.delete({} as Member, repositories, v4(), v4());
  });

  it('index item if it is published', async () => {
    jest.spyOn(itemService, 'get').mockResolvedValue({} as Item);
    jest.spyOn(repositories.itemTagRepository, 'delete').mockResolvedValue();
    jest
      .spyOn(repositories.itemPublishedRepository, 'getForItem')
      .mockResolvedValue({} as unknown as ItemPublished);

    await itemTagService.delete({} as Member, repositories, v4(), v4());
  });
});
