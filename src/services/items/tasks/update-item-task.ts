// global
import { ItemNotFound, UserCannotWriteItem } from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { UnknownExtra } from '../../../interfaces/extra';
// other services
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { Item } from '../interfaces/item';

// class UpdateItemSubTask extends BaseItemTask<Item> {
//   get name() { return UpdateItemSubTask.name; }

//   constructor(member: Member, itemId: string, data: Partial<Item>,
//     itemService: ItemService, itemMembershipService: ItemMembershipService) {
//     super(member, itemService, itemMembershipService);
//     this.data = data;
//     this.targetId = itemId;
//   }

//   async run(handler: DatabaseTransactionHandler) {
//     this.status = 'RUNNING';
//     const item = await this.itemService.update(this.targetId, this.data, handler);
//     this.status = 'OK';
//     this._result = item;
//   }
// }

export class UpdateItemTask<E extends UnknownExtra> extends BaseItemTask<Item<E>> {
  get name(): string { return UpdateItemTask.name; }
  // private subtasks: UpdateItemSubTask[];

  constructor(member: Member, itemId: string, data: Partial<Item<E>>,
    itemService: ItemService, itemMembershipService: ItemMembershipService) {
    super(member, itemService, itemMembershipService);
    this.data = data;
    this.targetId = itemId;
  }

  // private extractPropagatingChanges() {
  //   return BaseItem.propagatingProperties.reduce(
  //     (acc, key) => this.data[key] != null ? { ...acc, [key]: this.data[key] } : acc,
  //     {}
  //   );
  // }

  // get result(): Item {
  //   // if item has no descendants or subtasks are still 'New'
  //   if (!this.subtasks || this.subtasks.some(st => st.status === 'NEW')) return this._result;

  //   // return the result of the last subtask that executed successfully,
  //   // in other words, the last updated item
  //   return this.subtasks.filter(st => st.status === 'OK').pop().result;
  // }

  async run(handler: DatabaseTransactionHandler): Promise<void> {
    this.status = 'RUNNING';

    // get item
    const item = await this.itemService.get(this.targetId, handler);
    if (!item) throw new ItemNotFound(this.targetId);

    // verify membership rights over item - write
    const hasRights = await this.itemMembershipService.canWrite(this.actor.id, item, handler);
    if (!hasRights) throw new UserCannotWriteItem(this.targetId);

    // prepare changes
    // allow for individual changes in extra's own properties except if 'extra' is {};
    // in that case 'extra' is fully replace by {} (empty object).
    if (this.data.extra && Object.keys(this.data.extra).length > 0) {
      this.data.extra = Object.assign({}, item.extra, this.data.extra);
    }

    // check if there's any propagating changes
    // const propagatingChanges: Partial<Item> = this.extractPropagatingChanges();
    // if (Object.keys(propagatingChanges).length) {
    //   // get descendants
    //   const descendants =
    //     await this.itemService.getDescendants(item, handler, 'DESC', 'ALL', ['id']);

    //   // check how "big the tree is" below the item
    //   if (descendants.length > MAX_DESCENDANTS_FOR_UPDATE) {
    //     throw new TooManyDescendants(this.targetId);
    //   } else if (descendants.length > 0) {
    //     this.status = 'DELEGATED';

    //     // return list of subtasks for task manager to execute and
    //     // update item + all descendants, one by one.
    //     this.subtasks = descendants
    //       // for all the descendants only pass the propagating changes
    //       .map(d => new UpdateItemSubTask(this.actor, d.id, propagatingChanges, this.itemService, this.itemMembershipService))
    //       // for the target item, pass all the changes
    //       .concat(new UpdateItemSubTask(this.actor, this.targetId, this.data, this.itemService, this.itemMembershipService));

    //     return this.subtasks;
    //   }
    // }

    // no propagating changes: just update target item
    this._result = await this.itemService.update(this.targetId, this.data, handler);
    this.status = 'OK';
  }
}
