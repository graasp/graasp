import { EntityManager } from 'typeorm';

import { TagCategory } from '@graasp/sdk';

import { MutableRepository } from '../../../../repositories/MutableRepository';
import { DEFAULT_PRIMARY_KEY } from '../../../../repositories/const';
import { Tag } from './Tag.entity';

type UpdateTagBody = {
  // nothing
};

export class TagRepository extends MutableRepository<Tag, UpdateTagBody> {
  constructor(manager?: EntityManager) {
    super(DEFAULT_PRIMARY_KEY, Tag, manager);
  }

  async get(tagId: Tag['id']): Promise<Tag | null> {
    this.throwsIfPKIsInvalid(tagId);

    return await this.repository.findOneBy({ id: tagId });
  }

  async addOne(tag: { name: string; category: TagCategory }): Promise<Tag> {
    return await super.insert({ name: tag.name.trim(), category: tag.category });
  }

  async addOneIfDoesNotExist(tagInfo: { name: string; category: TagCategory }): Promise<Tag> {
    const tag = await this.repository.findOneBy(tagInfo);

    if (tag) {
      return tag;
    }

    return await this.addOne(tagInfo);
  }
}
