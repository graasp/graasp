import { singleton } from 'tsyringe';

import { DBConnection } from '../../drizzle/db';
import { ItemTagRepository } from '../item/plugins/tag/ItemTag.repository';
import { TagCategoryOptions } from './tag.schemas';

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
