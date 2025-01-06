import { TagCategory, TagFactory } from '@graasp/sdk';

import { AppDataSource } from '../../../plugins/datasource';
import { assertIsDefined } from '../../../utils/assertions';
import { Tag } from '../Tag.entity';

/**
 * Repository with util functions for Tag
 * Used for tests only
 */
export const TagRepositoryForTest = AppDataSource.getRepository(Tag).extend({
  /**
   * Add and return a tag, does not throw in case of duplicata
   * It is safe to catch errors when this function is used to set up a test
   * @param args
   * @returns saved tag
   */
  async saveTag(args: { name?: string; category?: TagCategory } = {}) {
    const tag = TagFactory(args);
    try {
      return await this.save(tag);
    } catch (e) {
      const t = await this.findOneBy(args);
      assertIsDefined(t);
      return t;
    }
  },
});
