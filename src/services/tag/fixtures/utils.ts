import { TagCategory, TagFactory } from '@graasp/sdk';

import { AppDataSource } from '../../../plugins/datasource';
import { assertIsDefined } from '../../../utils/assertions';
import { Tag } from '../Tag.entity';

const tagRawRepository = AppDataSource.getRepository(Tag);

/**
 * Add and return a tag, does not throw in case of duplicata
 * It is safe to catch errors when this function is used to set up a test
 * @param args
 * @returns
 */
export async function saveTag(args: { name?: string; category?: TagCategory } = {}) {
  const tag = TagFactory(args);
  try {
    return await tagRawRepository.save(tag);
  } catch (e) {
    const t = await tagRawRepository.findOneBy(args);
    assertIsDefined(t);
    return t;
  }
}
