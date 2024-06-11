import { Repositories } from '../../../../utils/repositories';
import { Actor } from '../../../member/entities/member';
import { ItemService } from '../../service';
import { ItemTagRepository } from './repository';
import { ItemTagService } from './service';

const itemServiceForTest = {
  getMany: jest.fn().mockReturnValue({ data: {}, errors: [] }),
} as unknown as ItemService;

describe('getForManyItems', () => {
  const actor: Actor = undefined;
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
