import { singleton } from 'tsyringe';

import { type DBConnection } from '../../drizzle/db';
import { ItemTagRepository } from '../item/plugins/tag/itemTag.repository';
import type { TagCategoryOptions } from './tag.schemas';

@singleton()
export class TagService {
  private readonly itemTagRepository: ItemTagRepository;

  constructor(itemTagRepository: ItemTagRepository) {
    this.itemTagRepository = itemTagRepository;
  }

  async getCountBy(dbConnection: DBConnection, search: string, category: TagCategoryOptions) {
    return await this.itemTagRepository.getCountBy(dbConnection, { search, category });
  }
}
