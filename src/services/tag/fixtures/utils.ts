import { and, eq } from 'drizzle-orm/sql';

import { TagCategory, TagFactory } from '@graasp/sdk';

import { db } from '../../../drizzle/db.js';
import { tags } from '../../../drizzle/schema.js';
import { assertIsDefined } from '../../../utils/assertions.js';

/**
 * Add and return a tag, does not throw in case of duplicata
 * It is safe to catch errors when this function is used to set up a test
 * @param args
 * @returns
 */
export async function saveTag(args: { name?: string; category?: TagCategory } = {}) {
  const tag = TagFactory(args);
  try {
    const res = await db.insert(tags).values(tag).returning();
    const t = res[0];
    assertIsDefined(t);
    return t;
  } catch {
    const t = await db.query.tags.findFirst({
      where: and(eq(tags.name, tag.name), eq(tags.category, tag.category)),
    });
    assertIsDefined(t);
    return t;
  }
}
