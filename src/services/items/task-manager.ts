// global
import { Task } from '../../interfaces/task';
import { UnknownExtra } from '../../interfaces/extra';
// other services
import { Member } from '../../services/members/interfaces/member';
import { ItemMembershipService } from '../../services/item-memberships/db-service';
import { ItemMembership, PermissionLevel } from '../item-memberships/interfaces/item-membership';
import { GetMemberItemMembershipOverItemTask } from '../item-memberships/tasks/get-member-item-membership-over-item-task';
import { BaseItemMembership } from '../item-memberships/base-item-membership';
import { CreateItemMembershipSubTask } from '../item-memberships/tasks/create-item-membership-task';

// local
import { ItemService } from './db-service';
import { Item } from './interfaces/item';
import { GetItemTask } from './tasks/get-item-task';
import { FolderExtra, GetItemChildrenTask } from './tasks/get-item-children-task';
import { GetOwnItemsTask } from './tasks/get-own-items-task';
import { GetItemsSharedWithTask } from './tasks/get-items-shared-with-task';
import { CreateItemTask } from './tasks/create-item-task';
import { UpdateItemTask } from './tasks/update-item-task';
import { DeleteItemTask } from './tasks/delete-item-task';
import { MoveItemTask } from './tasks/move-item-task';
import { CopyItemTask } from './tasks/copy-item-task';
import { ItemTaskManager } from './interfaces/item-task-manager';
import { GetManyItemsTask } from './tasks/get-many-items-task';

export class TaskManager implements ItemTaskManager<Member> {
  private itemService: ItemService;
  private itemMembershipService: ItemMembershipService;

  constructor(itemService: ItemService, itemMembershipService: ItemMembershipService) {
    this.itemService = itemService;
    this.itemMembershipService = itemMembershipService;
  }

  getCreateTaskName(): string {
    return CreateItemTask.name;
  }
  getGetTaskName(): string {
    return GetItemTask.name;
  }
  getUpdateTaskName(): string {
    return UpdateItemTask.name;
  }
  getDeleteTaskName(): string {
    return DeleteItemTask.name;
  }

  getMoveTaskName(): string {
    return MoveItemTask.name;
  }
  getCopyTaskName(): string {
    return CopyItemTask.name;
  }
  getGetChildrenTaskName(): string {
    return GetItemChildrenTask.name;
  }
  getGetOwnTaskName(): string {
    return GetOwnItemsTask.name;
  }
  getGetSharedWithTaskName(): string {
    return GetItemsSharedWithTask.name;
  }

  // CRUD
  createCreateTaskSequence(
    member: Member,
    data: Partial<Item>,
    parentId?: string,
  ): Task<Member, unknown>[] {
    const tasks = [];
    let t1: GetItemTask<UnknownExtra>;
    let t2: GetMemberItemMembershipOverItemTask;

    if (parentId) {
      t1 = new GetItemTask(member, this.itemService, { itemId: parentId });
      tasks.push(t1);

      t2 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
      t2.getInput = () => ({ item: t1.result, validatePermission: PermissionLevel.Write });
      tasks.push(t2);
    }

    const t3 = new CreateItemTask(member, this.itemService, { data });
    if (parentId) t3.getInput = () => ({ parentItem: t1.result });
    tasks.push(t3);

    const t4 = new CreateItemMembershipSubTask(member, this.itemMembershipService);
    t4.getInput = () => {
      if (!parentId || t2.result.permission === PermissionLevel.Write) {
        return {
          data: new BaseItemMembership(member.id, t3.result.path, PermissionLevel.Admin, member.id),
        };
      }
      t4.skip = true; // skip this task (t4)
    };
    t4.getResult = () => t3.result;
    tasks.push(t4);

    return tasks;
  }

  createGetTask(member: Member, itemId: string): Task<Member, unknown> {
    return new GetItemTask(member, this.itemService, { itemId });
  }

  createGetManyTask(member: Member, itemIds?: string[]): Task<Member, unknown> {
    return new GetManyItemsTask(member, this.itemService, { itemIds });
  }

  createGetTaskSequence(member: Member, itemId: string): Task<Member, unknown>[] {
    const t1 = new GetItemTask(member, this.itemService, { itemId });

    const t2 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService, {
      validatePermission: PermissionLevel.Read,
    });
    t2.getInput = () => {
      return { item: t1.result };
    };
    t2.getResult = () => t1.result;

    return [t1, t2];
  }

  createUpdateTaskSequence(
    member: Member,
    itemId: string,
    data: Partial<Item>,
  ): Task<Member, unknown>[] {
    const t1 = new GetItemTask(member, this.itemService, { itemId });

    const t2 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
    t2.getInput = () => ({ item: t1.result, validatePermission: PermissionLevel.Write });

    const t3 = new UpdateItemTask(member, this.itemService, { data });
    t3.getInput = () => ({ item: t1.result });

    return [t1, t2, t3];
  }

  createDeleteTask(member: Member, item?: Item): Task<Member, unknown> {
    return new DeleteItemTask(member, this.itemService, { item });
  }

  createDeleteTaskSequence(member: Member, itemId: string): Task<Member, unknown>[] {
    const t1 = new GetItemTask(member, this.itemService, { itemId });

    const t2 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
    t2.getInput = () => ({ item: t1.result, validatePermission: PermissionLevel.Admin });

    const t3 = new DeleteItemTask(member, this.itemService);
    t3.getInput = () => ({ item: t1.result });

    return [t1, t2, t3];
  }

  // Other
  createMoveTaskSequence(
    member: Member,
    itemId: string,
    parentId?: string,
  ): Task<Member, unknown>[] {
    const tasks = [];
    const t1 = new GetItemTask(member, this.itemService, { itemId });
    tasks.push(t1);

    const t2 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
    t2.getInput = () => ({ item: t1.result, validatePermission: PermissionLevel.Admin });
    tasks.push(t2);

    let t3: Task<Member, Item>;
    let t4: Task<Member, ItemMembership>;

    if (parentId) {
      t3 = new GetItemTask(member, this.itemService, { itemId: parentId });
      tasks.push(t3);

      t4 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
      t4.getInput = () => ({ item: t3.result, validatePermission: PermissionLevel.Write });
      tasks.push(t4);
    }

    const t6 = new MoveItemTask(member, this.itemService, this.itemMembershipService);
    t6.getInput = () => ({ item: t1.result, parentItem: t3?.result });
    tasks.push(t6);

    return tasks;
  }

  createCopyTaskSequence(
    member: Member,
    itemId: string,
    options: { parentId?: string; shouldCopyTags?: boolean },
  ): Task<Member, unknown>[] {
    const { parentId, shouldCopyTags } = options;
    const tasks = [];
    const t1 = new GetItemTask(member, this.itemService, { itemId });
    tasks.push(t1);

    const t2 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
    t2.getInput = () => ({ item: t1.result, validatePermission: PermissionLevel.Read });
    tasks.push(t2);

    tasks.push(...this.createCopySubTaskSequence(member, t1, { parentId, shouldCopyTags }));
    return tasks;
  }

  createCopySubTaskSequence(
    member: Member,
    itemTask: Task<Member, Item>,
    options: { parentId?: string; shouldCopyTags?: boolean },
  ): Task<Member, unknown>[] {
    const { parentId, shouldCopyTags } = options;
    const tasks = [];

    let t3: Task<Member, Item>;
    let t4: Task<Member, ItemMembership>;

    if (parentId) {
      t3 = new GetItemTask(member, this.itemService, { itemId: parentId });
      tasks.push(t3);

      t4 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
      t4.getInput = () => ({ item: t3.result, validatePermission: PermissionLevel.Write });
      tasks.push(t4);
    }

    const t5 = new CopyItemTask(member, this.itemService);
    t5.getInput = () => ({ item: itemTask.result, parentItem: t3?.result, shouldCopyTags });
    tasks.push(t5);

    const t6 = new CreateItemMembershipSubTask(member, this.itemMembershipService);
    t6.getInput = function () {
      if (!parentId || t4.result.permission === PermissionLevel.Write) {
        return {
          data: new BaseItemMembership(member.id, t5.result.path, PermissionLevel.Admin, member.id),
        };
      }
      this.skip = true; // skip this task (t6)
    };
    t6.getResult = () => t5.result;
    tasks.push(t6);

    return tasks;
  }

  createGetChildrenTask(
    member: Member,
    { item, ordered }: { item?: Item<FolderExtra>; ordered?: boolean },
  ): Task<Member, unknown> {
    return new GetItemChildrenTask(member, this.itemService, { item, ordered });
  }

  createGetChildrenTaskSequence(
    member: Member,
    itemId: string,
    ordered?: boolean,
  ): Task<Member, unknown>[] {
    const t1 = new GetItemTask<FolderExtra>(member, this.itemService, { itemId });

    const t2 = new GetMemberItemMembershipOverItemTask(member, this.itemMembershipService);
    t2.getInput = () => ({ item: t1.result, validatePermission: PermissionLevel.Read });

    const t3 = new GetItemChildrenTask(member, this.itemService, { ordered });
    t3.getInput = () => ({ item: t1.result });

    return [t1, t2, t3];
  }

  createGetOwnTask(member: Member): GetOwnItemsTask {
    return new GetOwnItemsTask(member, this.itemService);
  }

  createGetSharedWithTask(member: Member): GetItemsSharedWithTask {
    return new GetItemsSharedWithTask(member, this.itemService);
  }
}
