import { Repositories } from '../../../../../utils/repositories';
import { Actor } from '../../../../member/entities/member';

export class CategoryService {
  async getAll(actor: Actor, repositories: Repositories) {
    const { categoryRepository } = repositories;
    return categoryRepository.getAll();
  }
}
