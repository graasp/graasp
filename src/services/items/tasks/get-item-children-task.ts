// global
import { DatabaseTransactionHandler } from '../../../plugins/database';
// other services
import { Member } from '../../members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';
import { FastifyLoggerInstance } from 'fastify';
import { TaskStatus } from '../../..';

export const sortChildrenWith = (idsOrder: string[]) => (stElem: Item, ndElem: Item) => {
  if (idsOrder.indexOf(stElem.id) >= 0 && idsOrder.indexOf(ndElem.id) >= 0) {
    return idsOrder.indexOf(stElem.id) - idsOrder.indexOf(ndElem.id);
  }
  if (idsOrder.indexOf(stElem.id) >= 0) {
    return -1;
  }

  if (idsOrder.indexOf(ndElem.id) >= 0) {
    return 1;
  }

  return Date.parse(stElem.createdAt) - Date.parse(ndElem.createdAt);
};

export type FolderExtra = { folder: { childrenOrder: string[] } };
type InputType = { item?: Item<FolderExtra>; ordered?: boolean };

export class GetItemChildrenTask extends BaseItemTask<Item[]> {
  get name(): string {
    return GetItemChildrenTask.name;
  }

  input: InputType;
  getInput: () => InputType;

  constructor(member: Member, itemService: ItemService, input?: InputType) {
    super(member, itemService);
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { item, ordered } = this.input;
    this.targetId = item.id;

    // get item's children
    const children = await this.itemService.getDescendants(item, handler, 'ASC', 1);

    if (ordered) {
      const {
        extra: { folder: { childrenOrder = [] } = {} },
      } = item;

      if (childrenOrder.length) {
        const compareFn = sortChildrenWith(childrenOrder);
        children.sort(compareFn);
      }
    }

    await this.postHookHandler?.(children, this.actor, { log, handler });

    this.status = TaskStatus.OK;
    this._result = children;
  }
}
