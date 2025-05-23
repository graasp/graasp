import { and, eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { TagCategoryType } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { tagsTable } from '../../drizzle/schema';
import { TagRaw } from '../../drizzle/types';
import { IllegalArgumentException } from '../../repositories/errors';

@singleton()
export class TagRepository {
  private sanitizeName(name: string) {
    // remove useless spacing
    return name.trim().replace(/ +(?= )/g, '');
  }

  async get(dbConnection: DBConnection, tagId: TagRaw['id']): Promise<TagRaw | undefined> {
    if (!tagId) {
      throw new IllegalArgumentException('tagId is not valid');
    }
    const tag = await dbConnection.query.tagsTable.findFirst({ where: eq(tagsTable.id, tagId) });
    return tag;
  }

  async addOne(
    dbConnection: DBConnection,
    tag: { name: string; category: TagCategoryType },
  ): Promise<TagRaw> {
    const createdTag = await dbConnection
      .insert(tagsTable)
      .values({ name: this.sanitizeName(tag.name), category: tag.category })
      .returning();
    if (createdTag.length != 1) {
      throw new Error('Expectation failed: Receiving a single tag back when creating.');
    }
    return createdTag[0];
  }

  async addOneIfDoesNotExist(
    dbConnection: DBConnection,
    tagInfo: { name: string; category: TagCategoryType },
  ): Promise<TagRaw> {
    const tag = await dbConnection.query.tagsTable.findFirst({
      where: and(
        eq(tagsTable.name, this.sanitizeName(tagInfo.name)),
        eq(tagsTable.category, tagInfo.category),
      ),
    });

    if (tag) {
      return tag;
    }

    return await this.addOne(dbConnection, tagInfo);
  }
}
