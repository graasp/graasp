import { PermissionLevel } from '@graasp/sdk';

import { SearchFields } from '.';
import { Repositories } from '../../../../../../utils/repositories';
import { filterOutHiddenItems, validatePermission } from '../../../../../authorization';

// this file is not quite necessary, it could be merged with published items
// but we might change the search logic, so let's not mix everything
export class SearchService {
  // WORKS ONLY FOR PUBLISHED ITEMS
  async search(actor, repositories: Repositories, searchFields: SearchFields) {
    const { itemRepository, itemPublishedRepository } = repositories;

    const { parentId, name, keywords, tags, creator } = searchFields;

    const query = itemPublishedRepository
      .createQueryBuilder('publishedItem')
      .leftJoinAndSelect('publishedItem.item', 'item')
      .leftJoinAndSelect('item.creator', 'member');

    if (parentId) {
      const parentItem = await itemRepository.get(parentId);
      await validatePermission(repositories, PermissionLevel.Read, actor, parentItem);
      query.andWhere('item.path <@ :path', { path: parentItem.path });
    }

    if (name) {
      query.andWhere("LOWER(item.name) LIKE '%' || :name || '%'", {
        name: name.toLowerCase().trim(),
      });
    }

    if (tags) {
      // TODO: change
      // difficult to get array of text, so use like on array string
      tags.forEach((t, idx) => {
        const key = `tag_${idx}`;
        query.andWhere(`item.settings::jsonb->>'tags' LIKE \'%\' || :${key} || \'%\'`, {
          [key]: t,
        });
      });
    }

    if (creator) {
      query.andWhere("LOWER(member.name) LIKE '%' || :creator || '%'", {
        creator: creator.toLowerCase().trim(),
      });
    }

    const publishedItemValues = await query.getMany();

    // remove hidden items
    return filterOutHiddenItems(
      repositories,
      publishedItemValues.map(({ item }) => item),
    );
  }
}
