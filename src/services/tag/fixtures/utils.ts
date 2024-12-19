import { TagCategory, TagFactory } from '@graasp/sdk';

import { AppDataSource } from '../../../plugins/datasource';
import { assertIsDefined } from '../../../utils/assertions';
import { Tag } from '../Tag.entity';

const tagRawRepository = AppDataSource.getRepository(Tag);

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
