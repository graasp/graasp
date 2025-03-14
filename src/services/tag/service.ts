import { singleton } from 'tsyringe';

import type { DBConnection } from '../../drizzle/db.js';
import { ItemTagRepository } from '../item/plugins/tag/ItemTag.repository.js';
import type { TagCategoryOptions } from './schemas.js';

@singleton()
export class TagService {
  private readonly itemTagRepository: ItemTagRepository;

  constructor(itemTagRepository: ItemTagRepository) {
    this.itemTagRepository = itemTagRepository;
  }

  async getCountBy(db: DBConnection, search: string, category: TagCategoryOptions) {
    return await this.itemTagRepository.getCountBy(db, { search, category });
  }
}
