// global
import { v4 as uuidv4 } from 'uuid';
import { UnknownExtra } from '../../interfaces/extra';
// local
import { Item } from './interfaces/item';

const dashToUnderscore = (value: string) => value.replace(/-/g, '_');
const underscoreToDash = (value: string) => value.replace(/_/g, '-');

export class BaseItem<E extends UnknownExtra> implements Item<E> {
  // static propagatingProperties: (keyof Item)[] = []; // TODO: incomplete

  readonly id: string;
  name: string;
  description: string;
  type: string;
  path: string;
  extra: E;
  readonly creator: string;
  readonly createdAt: string;
  readonly updatedAt: string;

  constructor(
    name: string,
    description: string = null,
    type: string = 'base',
    extra: E,
    creator: string,
    parent?: Item
  ) {
    this.id = uuidv4();
    this.name = name;
    this.description = description;
    this.type = type;
    this.extra = extra;
    this.creator = creator;
    this.path = parent ?
      `${parent.path}.${dashToUnderscore(this.id)}` :
      dashToUnderscore(this.id);
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
