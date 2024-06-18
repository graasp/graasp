import { Repositories } from '../../../../utils/repositories.js';
import { Actor } from '../../../member/entities/member.js';
import { ItemService } from '../../service.js';
import { ItemTagRepository } from './repository.js';
import { ItemTagService } from './service.js';

const itemServiceForTest = {
  getMany: jest.fn().mockReturnValue({ data: {}, errors: [] }),
} as unknown as ItemService;

describe('getForManyItems', () => {
  const actor: Actor = undefined;

  afterEach(() => {
    jest.resetAllMocks();
  });
  it('returns empty data when requesting no ids', async () => {
    const repositories = {
      itemTagRepository: {
        getForManyItems: jest.fn(),
      } as unknown as typeof ItemTagRepository,
    } as unknown as Repositories;

    const tagService = new ItemTagService(itemServiceForTest);

    const res = await tagService.getForManyItems(actor, repositories, []);
    expect(res).toEqual({ data: {}, errors: [] });
    expect(repositories.itemTagRepository.getForManyItems).not.toHaveBeenCalled();
  });
});
