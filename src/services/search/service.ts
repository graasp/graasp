import { PermissionLevel } from '@graasp/sdk';

import { SearchFields } from '.';
import { Repositories } from '../../util/repositories';
import { filterOutHiddenItems, validatePermission } from '../authorization';

// this file is not quite necessary, it could be merged with published items
// but we might change the search logic, so let's not mix everything
export class SearchService {
  // WORKS ONLY FOR PUBLISHED ITEMS
  async search(actor, repositories: Repositories, searchFields: SearchFields) {
    const { itemRepository, itemPublishedRepository } = repositories;

    const { parentId, name, keywords, tags, creator } = searchFields;

    const query = itemPublishedRepository
      .createQueryBuilder('publishedItem')
      .leftJoinAndSelect('publishedItem.item', 'item');
    // .select(['publishedItem.item']); // ts types does not apply?

    if (parentId) {
      const parentItem = await itemRepository.get(parentId);
      await validatePermission(repositories, PermissionLevel.Read, actor, parentItem);
      query.andWhere('item.path <@ :path', { path: parentItem.path });
    }

    if (name) {
      query.andWhere(`item.creator ILIKE %${name}%`);
    }

    // TODO
    // if(tags) {
    //   query.andWhere("item.settings.tags = :name", {name})
    // }

    if (creator) {
      query.andWhere(`item.creator ILIKE %${creator}%`);
    }

    // TODO
    // if(tags.length) {
    //   query.andWhere(`item.settings.tags @> ${tags}`)
    // }

    // keywords
    // query.andWhere`
    //       WITH published_item_paths AS (
    //         SELECT item_path FROM item_tag
    //         WHERE tag_id = ${this.publishedTagId}
    //       )
    //       SELECT ${SearchService.allColumns}
    //       FROM item
    //       WHERE to_tsvector(
    //         name || ' ' || coalesce(description, '') || ' ' || coalesce(settings->>'tags', '')
    //         ) @@ to_tsquery(${keyword})
    //         AND path in (SELECT item_path FROM published_item_paths)
    //     `

    const publishedItemValues = await query.getMany();

    // remove hidden items
    return filterOutHiddenItems(
      repositories,
      publishedItemValues.map(({ item }) => item),
    );
  }
}
