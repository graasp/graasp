import { singleton } from 'tsyringe';

import { TagCategory } from '@graasp/sdk';

import { Repositories } from '../../utils/repositories';

@singleton()
export class TagService {
  async getCountBy(repositories: Repositories, search: string, category?: TagCategory) {
    const { itemTagRepository } = repositories;

    return await itemTagRepository.getCountBy({ search, category });
  }
}
