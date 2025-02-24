import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { TagCategory } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { Tag, tags } from '../../drizzle/schema';
import { IllegalArgumentException } from '../../repositories/errors';

@singleton()
export class TagRepository {
  private sanitizeName(name: string) {
    // remove useless spacing
    return name.trim().replace(/ +(?= )/g, '');
  }

  async get(db: DBConnection, tagId: Tag['id']): Promise<Tag | undefined> {
    if (!tagId) {
      throw new IllegalArgumentException('tagId is not valid');
    }
    const tag = await db.query.tags.findFirst({ where: eq(tags.id, tagId) });
    return tag;
  }

  async addOne(db: DBConnection, tag: { name: string; category: TagCategory }): Promise<Tag> {
    const createdTag = await db
      .insert(tags)
      .values({ name: this.sanitizeName(tag.name), category: tag.category })
      .returning();
    if (createdTag.length != 1) {
      throw new Error('Expectation failed: Receiving a single tag back when creating.');
    }
    return createdTag[0];
  }

  async addOneIfDoesNotExist(
    db: DBConnection,
    tagInfo: { name: string; category: TagCategory },
  ): Promise<Tag> {
    const tag = await db.query.tags.findFirst({
      where: and(
        eq(tags.name, this.sanitizeName(tagInfo.name)),
        eq(tags.category, tagInfo.category),
      ),
    });

    if (tag) {
      return tag;
    }

    return await this.addOne(db, tagInfo);
  }
}
