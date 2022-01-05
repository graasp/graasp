// global
import { FastifyLoggerInstance } from 'fastify';
import {
  HierarchyTooDeep,
  InvalidMoveTarget,
  TooManyDescendants,
} from '../../../util/graasp-error';
import { DatabaseTransactionHandler } from '../../../plugins/database';
import { MAX_DESCENDANTS_FOR_MOVE, MAX_TREE_LEVELS } from '../../../util/config';
// other services
import { ItemMembershipService } from '../../../services/item-memberships/db-service';
import { Member } from '../../../services/members/interfaces/member';
// local
import { ItemService } from '../db-service';
import { BaseItemTask } from './base-item-task';
import { BaseItem } from '../base-item';
import { Item } from '../interfaces/item';
import { TaskStatus } from '../../..';

type InputType = { item?: Item; parentItem?: Item };

export class MoveItemTask extends BaseItemTask<Item> {
  get name(): string {
    return MoveItemTask.name;
  }

  private itemMembershipService: ItemMembershipService;

  input: InputType;
  getInput: () => InputType;

  constructor(
    member: Member,
    itemService: ItemService,
    itemMembershipService: ItemMembershipService,
    input?: InputType,
  ) {
    super(member, itemService);
    this.itemMembershipService = itemMembershipService;
    this.input = input ?? {};
  }

  async run(handler: DatabaseTransactionHandler, log: FastifyLoggerInstance): Promise<void> {
    this.status = TaskStatus.RUNNING;

    const { item, parentItem } = this.input;
    this.targetId = item.id;

    // check how "big the tree is" below the item
    const numberOfDescendants = await this.itemService.getNumberOfDescendants(item, handler);
    if (numberOfDescendants > MAX_DESCENDANTS_FOR_MOVE) {
      throw new TooManyDescendants(item.id);
    }

    if (parentItem) {
      // attaching tree to new parent item
      const { id: parentItemId, path: parentItemPath } = parentItem;

      // fail if
      if (
        parentItemPath.startsWith(item.path) || // moving into itself or "below" itself
        BaseItem.parentPath(item) === parentItemPath // moving to the same parent ("not moving")
      ) {
        throw new InvalidMoveTarget(parentItemId);
      }

      // check how deep (number of levels) the resulting tree will be
      const levelsToFarthestChild = await this.itemService.getNumberOfLevelsToFarthestChild(
        item,
        handler,
      );

      if (BaseItem.itemDepth(parentItem) + 1 + levelsToFarthestChild > MAX_TREE_LEVELS) {
        throw new HierarchyTooDeep();
      }

      // TODO: should this info go into 'message'? (it's the only exception to the rule)
      this._message = `new parent ${parentItemId}`;
    } else if (!BaseItem.parentPath(item)) {
      // moving from "no-parent" to "no-parent" ("not moving")
      throw new InvalidMoveTarget();
    }

    await this.preHookHandler?.(item, this.actor, { log, handler }, { destination: parentItem });
    // move item
    await this.moveItem(item, handler, parentItem);
    const movedItem = await this.itemService.get(item.id, handler);

    await this.postHookHandler?.(
      movedItem,
      this.actor,
      { log, handler },
      { destination: parentItem },
    );

    this.status = TaskStatus.OK;
  }

  /**
   * Does the work of moving the item and the necessary changes to all the item memberships
   * involved.
   *
   * `this.itemMembershipService.moveHousekeeping()` runs first because membership paths
   * are *automatically* updated (`ON UPDATE CASCADE`) with `this.itemService.move()` and the
   * "adjustments" need to be calculated before - considering the origin membership paths.
   *
   * * `inserts`' `itemPath`s already have the expected paths for the destination;
   * * `deletes`' `itemPath`s have the path changes after `this.itemService.move()`.
   */
  private async moveItem(item: Item, handler: DatabaseTransactionHandler, parentItem?: Item) {
    // identify all the necessary adjustments to memberships
    // TODO: maybe this whole 'magic' should happen in a db procedure?
    const { inserts, deletes } = await this.itemMembershipService.moveHousekeeping(
      item,
      this.actor,
      handler,
      parentItem,
    );

    // move item (and subtree) - update paths of all items
    await this.itemService.move(item, handler, parentItem);

    // adjust memberships to keep the constraints
    if (inserts.length) await this.itemMembershipService.createMany(inserts, handler);
    if (deletes.length) await this.itemMembershipService.deleteManyMatching(deletes, handler);
  }
}
