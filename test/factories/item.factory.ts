import { faker } from '@faker-js/faker';
import { v4 } from 'uuid';

import { CCLicenseAdaptions, ItemType, buildPathFromIds } from '@graasp/sdk';

import type { ItemWithCreator } from '../../src/drizzle/types';

/**
 * This factory does not guarantee valid items given their type. But they are acceptable when seed into the db.
 * Create by default a folder
 * @param item partial properties
 * @returns complete item valid to be fed into the database
 */
export const ItemFactory = (
  itemArgs: Partial<ItemWithCreator> & { parentPath?: string } = {},
): ItemWithCreator => {
  const { parentPath, ...item } = itemArgs;
  const id = v4();

  const parentPrefix = parentPath ? `${parentPath}.` : '';
  const path = `${parentPrefix}${buildPathFromIds(id)}`;

  return {
    type: ItemType.FOLDER,
    order: null,
    name: faker.word.words(4),
    description: faker.lorem.text(),
    extra: { folder: {} },
    settings:
      item.settings ??
      faker.helpers.arrayElement([
        {},
        {
          isPinned: faker.datatype.boolean(),
          showChatbox: faker.datatype.boolean(),
          hasThumbnail: false,
          isResizable: faker.datatype.boolean(),
          isCollapsible: faker.datatype.boolean(),
          enableSaveActions: faker.datatype.boolean(),
          displayCoEditors: faker.datatype.boolean(),
          ccLicenseAdaption: faker.helpers.enumValue(CCLicenseAdaptions),
        },
      ]),
    lang: item.lang ?? faker.helpers.arrayElement(['fr', 'en', 'it', 'es', 'ar', 'de']),
    creatorId: null,
    creator: null,
    id,
    path,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...item,
  };
};
