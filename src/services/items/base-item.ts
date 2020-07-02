// global
import { v4 as uuidv4 } from 'uuid';
// local
import { Item } from './interfaces/item';

const dashToUnderscore = (value: string) => value.replace(/-/g, '_');

export class BaseItem implements Item {
  static propagatingProperties: (keyof Item)[] = []; // TODO: incomplete

  readonly id: string;
  name: string;
  description: string;
  path: string;
  extra: { [key: string]: unknown };
  readonly creator: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(
    name: string,
    description: string = null,
    extra: { [key: string]: unknown } = {},
    creator: string,
    parent?: Item
  ) {
    this.id = uuidv4();
    this.name = name;
    this.description = description;
    this.extra = extra;
    this.creator = creator;
    this.path = parent ?
      `${parent.path}.${dashToUnderscore(this.id)}` :
      dashToUnderscore(this.id);
  }

  static itemDepth(item: Item) {
    return item.path.split('.').length;
  }

  static parentPath(item: Item) {
    const index = item.path.lastIndexOf('.');
    return index === -1 ? null : item.path.slice(0, index);
  }
}
