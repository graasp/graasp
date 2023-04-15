import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../utils/repositories';
import { validatePermission } from '../../authorization';

export class CategoryService {
  async getAll(actor, repositories: Repositories) {
    const { categoryRepository } = repositories;
    return categoryRepository.getAll();
  }
}
