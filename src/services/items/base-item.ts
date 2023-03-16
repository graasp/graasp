import { v4 as uuidv4 } from 'uuid';

import { Item, ItemSettings, ItemType, UnknownExtra } from '@graasp/sdk';

import { DEFAULT_ITEM_SETTINGS } from '../../util/config';

export const dashToUnderscore = (value: string) => value.replace(/-/g, '_');
const underscoreToDash = (value: string) => value.replace(/_/g, '-');

export class BaseItem<E extends UnknownExtra> implements Item {
  // static propagatingProperties: (keyof Item)[] = []; // TODO: incomplete. remove?

  readonly id: Item['id'];
  name: Item['name'];
  description: Item['description'];
  type: Item['type'];
  path: Item['path'];
  extra: E;
  settings: Item['settings'];
  readonly creator: Item['creator'];
  readonly createdAt: Item['createdAt'];
  readonly updatedAt: Item['updatedAt'];

  constructor(
    name: Item['name'],
    description: Item['description'] = null,
    type: Item['type'] = ItemType.FOLDER,
    extra: E,
    settings: ItemSettings,
    creator: Item['creator'],
    parent?: Item,
  ) {
    this.id = uuidv4();
    this.name = name;
    this.description = description;
    this.type = type;
    // deep copy of extra
    this.extra = extra ? JSON.parse(JSON.stringify(extra)) : ({} as E);
    this.settings = settings ?? DEFAULT_ITEM_SETTINGS;
    this.creator = creator;
    this.path = parent ? `${parent.path}.${dashToUnderscore(this.id)}` : dashToUnderscore(this.id);
  }

  static itemDepth(item: Item): number {
    return item.path.split('.').length;
  }

  static parentPath(item: Item): string {
    const index = item.path.lastIndexOf('.');
    return index === -1 ? null : item.path.slice(0, index);
  }

  static pathToId(path: string): string {
    const index = path.lastIndexOf('.');
    return underscoreToDash(index === -1 ? path : path.slice(index + 1));
  }
}
