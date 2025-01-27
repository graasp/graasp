import { faker } from '@faker-js/faker';

import { CCLicenseAdaptions, ItemType } from '@graasp/sdk';

import { Item } from '../../src/services/item/entities/Item';

/**
 * This factory does not guarantee valid items given their type. But they are acceptable when seed into the db.
 * Create by default a folder
 * @param item partial properties
 * @returns complete item valid to be fed into the database
 */
export const ItemFactory = (item: Partial<Item>) => ({
  type: ItemType.FOLDER,
  order: null,
  name: faker.word.words(2),
  description: item.description ?? faker.lorem.text(),
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
        tags: faker.lorem.words({ min: 1, max: 10 }).split(' '),
        displayCoEditors: faker.datatype.boolean(),
        ccLicenseAdaption: faker.helpers.enumValue(CCLicenseAdaptions),
      },
    ]),
  lang: item.lang ?? faker.helpers.arrayElement(['fr', 'en', 'it', 'es', 'ar', 'de']),
  creator: null,
  ...item,
});
