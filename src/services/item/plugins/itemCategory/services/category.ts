import { Repositories } from '../../../../../utils/repositories.js';
import { Actor } from '../../../../member/entities/member.js';

export class CategoryService {
  async getAll(actor: Actor, repositories: Repositories) {
    const { categoryRepository } = repositories;
    return categoryRepository.getAll();
  }
}
